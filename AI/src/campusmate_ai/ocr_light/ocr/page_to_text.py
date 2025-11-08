from __future__ import annotations
from pathlib import Path
from typing import List, Dict, Any
import json
import os

import numpy as np

try:
    import cv2
except Exception:
    cv2 = None

from concurrent.futures import ThreadPoolExecutor, as_completed
from .engine import DualOCREngine

# (옵션) PDF 지원: pdf2image 설치 시 자동 사용
def _pdf_to_images(pdf_path: str, dpi: int = 200) -> List[np.ndarray]:
    try:
        from pdf2image import convert_from_path
    except Exception:
        return []
    pages = convert_from_path(pdf_path, dpi=dpi)
    out = []
    for p in pages:
        out.append(np.array(p)[:, :, ::-1])  # PIL RGB → BGR
    return out

def _imread_bgr(path: str):
    if cv2 is None:
        raise RuntimeError("OpenCV(cv2)가 필요합니다.")
    img = cv2.imread(path)
    return img

class PageToText:
    """
    - DualOCREngine를 1회 생성해 페이지 전체에 재사용(속도 ↑)
    - 이미지/폴더/PDF 모두 처리
    - 수업 중 빠른 응답을 위해 페이지 병렬 처리(쓰레드, I/O bound)
    """
    def __init__(self, cfg: Dict[str, Any]):
        self.cfg = cfg or {}
        ocr_cfg = self.cfg.get("ocr", {})
        self.engine = DualOCREngine(
            min_conf=float(ocr_cfg.get("min_conf", self.cfg.get("min_conf", 0.70))),
            det_limit_side_len=int(ocr_cfg.get("det_limit_side_len", 1920)),
            rec_batch_num=int(ocr_cfg.get("rec_batch_num", self.cfg.get("rec_batch", 8))),
            enable_board_preprocess=self.cfg.get("enable_board_preprocess", True),
        )
        self.workers = int(self.cfg.get("workers", os.cpu_count() or 2))

    # 파일/폴더 경로를 받아 페이지 리스트로 변환
    def _expand_inputs(self, inputs: List[str]) -> List[Dict[str, Any]]:
        files = []
        for x in inputs:
            p = Path(x)
            if p.is_dir():
                for q in sorted(p.iterdir()):
                    if q.suffix.lower() in {".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".pdf"}:
                        files.append(str(q))
            elif p.is_file():
                files.append(str(p))
        pages: List[Dict[str, Any]] = []
        page_no = 1
        for f in files:
            if f.lower().endswith(".pdf"):
                imgs = _pdf_to_images(f)
                for im in imgs:
                    pages.append({"src": f, "page": page_no, "image": im})
                    page_no += 1
            else:
                im = _imread_bgr(f)
                if im is not None:
                    pages.append({"src": f, "page": page_no, "image": im})
                    page_no += 1
        return pages

    def _run_one(self, page: Dict[str, Any]) -> Dict[str, Any]:
        items = self.engine.run(page["image"], self.cfg)
        return {"page": page["page"], "elements": items}

    # 기존 run_images 호환
    def run_images(self, image_paths: List[str]) -> List[Dict[str, Any]]:
        inputs = self._expand_inputs(image_paths)
        if not inputs:
            return []
        # 병렬 처리(네트워크/엔진 내부 I/O bound에서 체감 향상)
        out: List[Dict[str, Any]] = []
        with ThreadPoolExecutor(max_workers=max(1, self.workers)) as ex:
            futs = {ex.submit(self._run_one, p): p["page"] for p in inputs}
            done = []
            for fu in as_completed(futs):
                done.append(fu.result())
        for d in sorted(done, key=lambda x: x["page"]):
            out.append(d)
        return out

    # pipeline에서 hasattr(runner, "run") 호출 대비
    def run(self, inputs: List[str] | str) -> List[Dict[str, Any]]:
        if isinstance(inputs, str):
            inputs = [inputs]
        return self.run_images(inputs)

    def save(self, pages: List[Dict[str, Any]], out_path: str):
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(pages, f, ensure_ascii=False, indent=2)
