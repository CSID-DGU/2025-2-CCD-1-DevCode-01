from __future__ import annotations
from typing import List, Dict, Any, Tuple, Optional
import os
import re
import numpy as np

try:
    import cv2
except Exception:
    cv2 = None

from paddleocr import PaddleOCR
from .heuristics import HeuristicDetector

# ---------- PaddleOCR 싱글턴 캐시 (엔진 재사용으로 로딩 오버헤드 제거) ----------
_OCR_CACHE: dict[Tuple[str, bool, int, int], PaddleOCR] = {}

def _create_engine(
    lang: str,
    use_angle_cls: bool = True,
    det_limit_side_len: int = 1920,
    rec_batch_num: int = 8,
) -> PaddleOCR:
    """
    PaddleOCR 엔진 생성 (버전 호환)
    - ko: PP-OCRv3 우선
    - 그 외: PP-OCRv4 우선
    - det_limit_side_len/rec_batch_num은 지원 버전에서만 사용, 아니면 자동 폴백
    - show_log 같은 미지원 인자는 절대 전달하지 않음
    """
    key = (lang, use_angle_cls, det_limit_side_len, rec_batch_num)
    if key in _OCR_CACHE:
        return _OCR_CACHE[key]

    def _build(version: str | None):
        # 최소 인자만 먼저 시도
        base_kwargs = dict(lang=lang, use_angle_cls=use_angle_cls)
        if version is not None:
            base_kwargs["ocr_version"] = version

        # 1) 확장 인자 포함 시도
        try:
            return PaddleOCR(
                **base_kwargs,
                det_limit_side_len=det_limit_side_len,
                rec_batch_num=rec_batch_num,
            )
        except Exception:
            # 2) 확장 인자 제거하고 순수 기본 인자만
            return PaddleOCR(**base_kwargs)

    eng = None
    if lang == "korean":
        # ko는 v4 모델이 없어서 v3 우선
        try:
            eng = _build("PP-OCRv3")
        except Exception:
            eng = _build(None)
    else:
        # en 등은 v4 우선, 실패 시 v3
        try:
            eng = _build("PP-OCRv4")
        except Exception:
            eng = _build("PP-OCRv3")

    _OCR_CACHE[key] = eng
    return eng



# ---------- 유틸 ----------
def _bbox_from_quad(quad):
    xs = [p[0] for p in quad]; ys = [p[1] for p in quad]
    return [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]

def _iou(a, b):
    x1 = max(a[0], b[0]); y1 = max(a[1], b[1])
    x2 = min(a[2], b[2]); y2 = min(a[3], b[3])
    if x2 <= x1 or y2 <= y1: return 0.0
    inter = (x2 - x1) * (y2 - y1)
    areaA = (a[2] - a[0]) * (a[3] - a[1])
    areaB = (b[2] - b[0]) * (b[3] - b[1])
    return inter / (areaA + areaB - inter + 1e-6)

def _ensure_bgr(img) -> np.ndarray:
    """cv2 이미지면 그대로, PIL.Image면 BGR로 변환."""
    if isinstance(img, np.ndarray):
        return img
    try:
        from PIL import Image
        if isinstance(img, Image.Image):
            rgb = np.array(img.convert("RGB"))
            return rgb[:, :, ::-1]  # RGB->BGR
    except Exception:
        pass
    raise TypeError("Unsupported image type; expected ndarray (BGR) or PIL.Image")

# ---------- 엔진 ----------
class DualOCREngine:
    """
    ko/en을 모두 돌려 IoU 매칭으로 더 좋은 텍스트를 채택.
    - 엔진은 싱글턴 캐시를 통해 1회 로딩 후 재사용(속도 ↑)
    - 칠판/화이트보드 사진에 강한 라이트 전처리 옵션 포함
    """
    def __init__(
        self,
        min_conf: float = 0.70,
        det_limit_side_len: int = 1920,
        rec_batch_num: int = 8,
        enable_board_preprocess: bool = True,
    ):
        self.min_conf = float(min_conf)
        self.ko = _create_engine(
            "korean", True, det_limit_side_len, rec_batch_num
        )
        self.en = _create_engine(
            "en", True, det_limit_side_len, rec_batch_num
        )
        self.hdet = HeuristicDetector()
        self.enable_board_preprocess = enable_board_preprocess

    def _ocr(self, engine: PaddleOCR, bgr: np.ndarray):
        try:
            return engine.ocr(bgr, cls=True) or []
        except TypeError:
            return engine.ocr(bgr) or []

    # ---- 칠판·화이트보드 특화 라이트 전처리(대비/샤픈/노이즈 컷) ----
    def _board_preprocess(self, bgr: np.ndarray) -> np.ndarray:
        if cv2 is None:
            return bgr
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)

        # 조도 보정 + 대비 향상
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        g2 = clahe.apply(gray)

        # 샤프닝(고주파 강조)
        g3 = cv2.GaussianBlur(g2, (0, 0), 1.0)
        sharp = cv2.addWeighted(g2, 1.5, g3, -0.5, 0)

        # 얇은 분필/마커 스트로크 강조용 이진화
        th = cv2.adaptiveThreshold(
            sharp, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 31, 5
        )
        # 흑판(어두움) 대비: 흰글씨가 많으면 반전하지 않음, 그 외 상황은 역상 시도
        white_ratio = np.mean(th > 0)
        if white_ratio < 0.35:
            th = cv2.bitwise_not(th)

        return cv2.cvtColor(th, cv2.COLOR_GRAY2BGR)

    def run(self, img, cfg: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        bgr = _ensure_bgr(img)

        # 페이지 전역 휴리스틱: 텍스트 밀도 낮고 엣지 비율 높은 칠판/그림이면 전처리 가동
        if self.enable_board_preprocess and cv2 is not None:
            try:
                g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
                # 텍스트 면적 추정을 위해 가벼운 에지 & 히스토그램 사용
                edges = cv2.Canny(g, 60, 120)
                edge_ratio = float(np.count_nonzero(edges)) / float(edges.size)
                if edge_ratio > 0.03:  # 러프 임계치
                    bgr = self._board_preprocess(bgr)
            except Exception:
                pass

        res_ko = self._ocr(self.ko, bgr)
        res_en = self._ocr(self.en, bgr)

        # PaddleOCR의 리턴 포맷 통일
        if len(res_ko) > 0 and isinstance(res_ko[0], list) and len(res_ko) == 1 and isinstance(res_ko[0][0], list):
            res_ko = res_ko[0]
        if len(res_en) > 0 and isinstance(res_en[0], list) and len(res_en) == 1 and isinstance(res_en[0][0], list):
            res_en = res_en[0]

        en_used = [False] * len(res_en)
        items: List[Dict[str, Any]] = []

        # ko 기준으로 en 매칭
        for k in res_ko:
            kb = _bbox_from_quad(k[0])
            ktxt, kconf = (k[1][0] or "").strip(), float(k[1][1])

            best_j, best_iou, best = -1, 0.0, None
            for j, e in enumerate(res_en):
                if en_used[j]:
                    continue
                eb = _bbox_from_quad(e[0])
                iou = _iou(kb, eb)
                if iou > best_iou:
                    best_iou, best_j, best = iou, j, e

            if best and best_iou > 0.30:
                etxt, econf = (best[1][0] or "").strip(), float(best[1][1])
                # 괄호/수학기호/영문 혼용 → 영문 선호 가산
                prefer_en = (econf > kconf * 1.05) or any(ch in etxt for ch in "()^/*=+<>")
                txt, conf = (etxt, econf) if prefer_en else (ktxt, kconf)
                en_used[best_j] = True
            else:
                txt, conf = ktxt, kconf

            if conf >= self.min_conf and txt:
                items.append({"text": txt, "conf": conf, "bbox": kb})

        # 남은 en 항목 추가
        for j, e in enumerate(res_en):
            if en_used[j]:
                continue
            eb = _bbox_from_quad(e[0])
            etxt, econf = (e[1][0] or "").strip(), float(e[1][1])
            if econf >= self.min_conf and etxt:
                items.append({"text": etxt, "conf": econf, "bbox": eb})

        return items

# NOTE:
# 기존 파일 하단에 있던 _merge_text 는 미사용 + re 미임포트로 오류 위험이므로 제거했습니다.
