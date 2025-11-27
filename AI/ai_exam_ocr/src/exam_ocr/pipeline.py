"""
exam_ocr.pipeline

이미지 한 장(또는 세로로 합친 시험지 이미지)을 입력으로 받아
문항 단위 JSON(exam_questions.json)을 생성하는 파이프라인.
"""

from __future__ import annotations

import os
import re
import json
import base64
from typing import List, Dict, Any, Tuple

import cv2
import numpy as np
import requests
from paddleocr import PaddleOCR
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# ==============================
# 0. 환경 설정 & 공통 상수
# ==============================

ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY")
MODEL_ID = os.environ.get("ROBOFLOW_MODEL_ID", "ccd-pn4pd/8")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

if not ROBOFLOW_API_KEY:
    raise RuntimeError("ROBOFLOW_API_KEY 환경변수를 설정해 주세요.")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY 환경변수를 설정해 주세요.")

client = OpenAI(api_key=OPENAI_API_KEY)

TEXTUAL_CLASSES = {"qnum","text", "choice", "code"}
VISUAL_CLASSES = {"chart", "table"}

# PaddleOCR는 전역에서 한 번만 생성
ocr = PaddleOCR(lang="korean", use_angle_cls=True)


# ==============================
# 1. 전처리 / OCR 유틸
# ==============================

def enhance_for_ocr(crop_bgr: np.ndarray, scale: int = 3, pad: int = 8) -> np.ndarray:
    """한글 시험지용 일반 텍스트 전처리."""
    h, w = crop_bgr.shape[:2]
    if h < 10 or w < 10:
        return crop_bgr

    crop_bgr = cv2.copyMakeBorder(
        crop_bgr, pad, pad, pad, pad,
        borderType=cv2.BORDER_CONSTANT,
        value=[255, 255, 255],
    )

    crop_big = cv2.resize(
        crop_bgr,
        None,
        fx=scale,
        fy=scale,
        interpolation=cv2.INTER_CUBIC,
    )

    kernel = np.array([[0, -1, 0],
                       [-1, 5, -1],
                       [0, -1, 0]])
    crop_sharp = cv2.filter2D(crop_big, -1, kernel)

    lab = cv2.cvtColor(crop_sharp, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.equalizeHist(l)
    lab = cv2.merge((l, a, b))
    crop_final = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    return crop_final


def enhance_for_code(crop_bgr: np.ndarray, scale: int = 3, pad: int = 4) -> np.ndarray:
    """코드/SQL 전용 이진화 전처리."""
    h, w = crop_bgr.shape[:2]
    if h < 10 or w < 10:
        return crop_bgr

    crop_bgr = cv2.copyMakeBorder(
        crop_bgr, pad, pad, pad, pad,
        borderType=cv2.BORDER_CONSTANT,
        value=[255, 255, 255],
    )
    crop_big = cv2.resize(crop_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    gray = cv2.cvtColor(crop_big, cv2.COLOR_BGR2GRAY)
    _, th = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    return cv2.cvtColor(th, cv2.COLOR_GRAY2BGR)


def enhance_for_choice(crop_bgr: np.ndarray, scale: int = 4, pad: int = 8) -> np.ndarray:
    """객관식 보기(선지) 전처리: 크게 키우고 여백만."""
    h, w = crop_bgr.shape[:2]
    if h < 10 or w < 10:
        return crop_bgr

    crop_bgr = cv2.copyMakeBorder(
        crop_bgr, pad, pad, pad, pad,
        borderType=cv2.BORDER_CONSTANT,
        value=[255, 255, 255],
    )
    crop_big = cv2.resize(
        crop_bgr,
        None,
        fx=scale,
        fy=scale,
        interpolation=cv2.INTER_CUBIC,
    )
    return crop_big


def paddle_ocr_with_newlines(crop_bgr: np.ndarray) -> str:
    """PaddleOCR 줄 단위 추출."""
    result = ocr.ocr(crop_bgr, cls=True)
    if not result or not result[0]:
        return ""
    lines = [r[1][0] for r in result[0]]
    return "\n".join(lines).strip()


def sort_by_reading_order(boxes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(boxes, key=lambda b: (b["bbox"][1], b["bbox"][0]))


def _extract_text_from_openai_message(message) -> str:
    """OpenAI SDK message.content 안전 추출."""
    content = message.content
    if isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, str):
                parts.append(c)
            elif isinstance(c, dict) and "text" in c:
                parts.append(c["text"])
            elif hasattr(c, "text"):
                parts.append(c.text)
        return "\n".join(parts).strip()
    if isinstance(content, str):
        return content.strip()
    return str(content).strip()


# ==============================
# 2. Roboflow 객체 검출
# ==============================

def detect_boxes_with_roboflow(img_path: str) -> Tuple[np.ndarray, List[Dict[str, Any]]]:
    img_bgr = cv2.imread(img_path)
    if img_bgr is None:
        raise FileNotFoundError(img_path)

    with open(img_path, "rb") as f:
        resp = requests.post(
            f"https://detect.roboflow.com/{MODEL_ID}?api_key={ROBOFLOW_API_KEY}&format=json",
            files={"file": f},
        )

    data = resp.json()
    preds = data.get("predictions", [])

    all_boxes = []
    for p in preds:
        x, y, pw, ph = p["x"], p["y"], p["width"], p["height"]
        cls = p["class"]
        x1 = int(x - pw / 2)
        y1 = int(y - ph / 2)
        x2 = int(x + pw / 2)
        y2 = int(y + ph / 2)
        all_boxes.append(
            {"class_name": cls, "bbox": (x1, y1, x2, y2), "conf": p.get("confidence", 0.0)}
        )

    return img_bgr, all_boxes


# ==============================
# 3. qnum 정제 + 레이아웃 / 문항 묶기
# ==============================

def ocr_qnum_only(img_bgr: np.ndarray, bbox) -> Tuple[int | None, str]:
    """qnum 박스 왼쪽 일부만 잘라 숫자만 읽기."""
    x1, y1, x2, y2 = bbox
    w_box = x2 - x1
    x2_small = x1 + int(w_box * 0.4)
    crop = img_bgr[y1:y2, x1:x2_small]
    crop = enhance_for_ocr(crop, scale=4, pad=4)
    raw = paddle_ocr_with_newlines(crop)
    m = re.search(r"\d+", raw)
    if m:
        return int(m.group(0)), raw
    return None, raw


def detect_layout_and_mid_x(qnum_boxes: List[Dict[str, Any]],
                            img_width: int,
                            min_gap_ratio: float = 0.15) -> Tuple[str, float | None]:
    centers = sorted(((b["bbox"][0] + b["bbox"][2]) / 2.0 for b in qnum_boxes))
    if len(centers) < 3:
        return "single", None

    gaps = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]
    max_gap = max(gaps)
    max_gap_idx = gaps.index(max_gap)

    if max_gap / img_width > min_gap_ratio:
        mid_x = (centers[max_gap_idx] + centers[max_gap_idx + 1]) / 2.0
        left_cnt = sum(c < mid_x for c in centers)
        right_cnt = sum(c >= mid_x for c in centers)
        if left_cnt >= 1 and right_cnt >= 1:
            return "double", mid_x

    return "single", None


def split_by_mid_x(boxes: List[Dict[str, Any]], mid_x: float):
    left, right = [], []
    for b in boxes:
        x1, y1, x2, y2 = b["bbox"]
        cx = (x1 + x2) / 2.0
        (left if cx < mid_x else right).append(b)
    return left, right


def assign_by_qnum_spans(content_boxes: List[Dict[str, Any]],
                         qnums: List[Dict[str, Any]],
                         img_height: int):
    if not qnums:
        return [], {}

    qnums_sorted = sorted(qnums, key=lambda b: b["bbox"][1])

    spans = []
    for i, qb in enumerate(qnums_sorted):
        top = qb["bbox"][1]
        bottom = qnums_sorted[i + 1]["bbox"][1] if i < len(qnums_sorted) - 1 else img_height
        spans.append({"idx": i, "qnum_box": qb, "top": top, "bottom": bottom})

    groups = {s["idx"]: [] for s in spans}
    for b in content_boxes:
        y1, y2 = b["bbox"][1], b["bbox"][3]
        cy = (y1 + y2) / 2
        for s in spans:
            if s["top"] <= cy < s["bottom"]:
                groups[s["idx"]].append(b)
                break

    return spans, groups


def build_structured(spans, groups):
    structured = []
    for s in spans:
        idx = s["idx"]
        qb = s["qnum_box"]
        qnum = qb.get("question_number")
        raw = qb.get("raw_qnum_text", "")
        boxes = groups[idx]

        q = {
            "question_number": qnum,
            "raw_qnum_text": raw,
            "qnum_bbox": qb["bbox"],
            "text": [],
            "choice": [],
            "chart": [],
            "table": [],
            "code": [],
        }
        for b in boxes:
            cls = b["class_name"]
            if cls in q:
                q[cls].append(b)
        structured.append(q)
    return structured


def build_structured_questions(img_bgr: np.ndarray,
                               all_boxes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    h, w, _ = img_bgr.shape

    qnum_boxes = [b for b in all_boxes if b["class_name"] == "qnum"]
    content_boxes = [b for b in all_boxes if b["class_name"] != "qnum"]

    clean_qnums = []
    demoted_to_text = []
    for b in qnum_boxes:
        qnum, raw = ocr_qnum_only(img_bgr, b["bbox"])
        if qnum is None:
            demoted_to_text.append(
                {"class_name": "text", "bbox": b["bbox"], "from_qnum": True, "raw_qnum_text": raw}
            )
        else:
            b["question_number"] = qnum
            b["raw_qnum_text"] = raw
            clean_qnums.append(b)

    qnum_boxes = clean_qnums
    content_boxes += demoted_to_text

    layout, mid_x = detect_layout_and_mid_x(qnum_boxes, w)

    if layout == "single":
        left_qnums, right_qnums = qnum_boxes, []
        left_contents, right_contents = content_boxes, []
    else:
        left_qnums, right_qnums = split_by_mid_x(qnum_boxes, mid_x)  # type: ignore[arg-type]
        left_contents, right_contents = split_by_mid_x(content_boxes, mid_x)  # type: ignore[arg-type]

    left_spans, left_groups = assign_by_qnum_spans(left_contents, left_qnums, h)
    if layout == "double":
        right_spans, right_groups = assign_by_qnum_spans(right_contents, right_qnums, h)
    else:
        right_spans, right_groups = [], {}

    left_struct = build_structured(left_spans, left_groups)
    right_struct = build_structured(right_spans, right_groups)
    structured_questions = left_struct + right_struct
    structured_questions = sorted(
        structured_questions,
        key=lambda q: (q["question_number"] if q["question_number"] is not None else 9999),
    )

    return structured_questions


# ==============================
# 4. structured_questions → seq_meta
# ==============================

def build_sequential_crops(structured_questions: List[Dict[str, Any]],
                           img_bgr: np.ndarray,
                           output_dir: str):
    seq_meta = []

    for q in structured_questions:
        qnum = q["question_number"]
        items = []
        idx = 0

        # qnum 먼저
        qbbox = q["qnum_bbox"]
        x1, y1, x2, y2 = qbbox
        crop = img_bgr[y1:y2, x1:x2]
        fname = os.path.join(output_dir, f"q{qnum}_{idx:02d}_qnum.png")
        cv2.imwrite(fname, crop)
        items.append({"index": idx, "kind": "qnum", "path": fname, "bbox": qbbox})
        idx += 1

        def add_kind(kind_name: str, box_list: List[Dict[str, Any]]):
            nonlocal idx, items
            for b in sort_by_reading_order(box_list):
                x1, y1, x2, y2 = b["bbox"]
                crop = img_bgr[y1:y2, x1:x2]
                fname = os.path.join(output_dir, f"q{qnum}_{idx:02d}_{kind_name}.png")
                cv2.imwrite(fname, crop)
                items.append(
                    {"index": idx, "kind": kind_name, "path": fname, "bbox": b["bbox"]}
                )
                idx += 1

        add_kind("text", q["text"])
        add_kind("chart", q["chart"])
        add_kind("table", q["table"])
        add_kind("code", q["code"])
        add_kind("choice", q["choice"])

        seq_meta.append({"question_number": qnum, "items": items})

    seq_meta_path = os.path.join(output_dir, "sequential_meta.json")
    with open(seq_meta_path, "w", encoding="utf-8") as f:
        json.dump(seq_meta, f, ensure_ascii=False, indent=2)

    return seq_meta


# ==============================
# 5. GPT Hybrid OCR
# ==============================

def hybrid_gpt_vision_with_paddle(img_path: str, paddle_text: str, kind: str = "text") -> str:
    with open(img_path, "rb") as f:
        image_bytes = f.read()
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    ext = os.path.splitext(img_path)[1].lower()
    mime = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
    image_url = f"data:{mime};base64,{b64}"

    if kind == "qnum":
        system_prompt = (
            "너는 시험지의 문항 번호를 정확히 읽어주는 OCR 보정기다.\n"
            "임의로 추가 설명, 해설, 요약을 절대로 넣지 마라.\n"
            "이미지 안에 인쇄된 텍스트 전체를, 문항 번호 줄부터 마지막 줄까지 그대로 출력해라."
        )
        user_text = (
            "이미지를 보고, 문항 번호 줄과 그 아래에 이어지는 모든 문장을 그대로 적어라.\n"
            "PaddleOCR 결과는 참고만 하고, 틀린 부분은 이미지 기준으로 수정해라.\n"
            "'최종 텍스트는' 같은 설명 문장은 쓰지 마라.\n"
            f"[Paddle 시작]\n{paddle_text}\n[Paddle 끝]"
        )
    elif kind == "choice":
        system_prompt = (
            "너는 시험지의 객관식 보기(선지)를 읽는 OCR 보정기다.\n"
            "보기 내용 외의 설명, 해설, 요약은 절대로 쓰지 마라.\n"
            "코드블록( ``` )도 쓰지 마라."
        )
        user_text = (
            "이미지를 보고, 보기들을 한 줄에 하나씩 적어라.\n"
            "예: '① ㄱ', '② ㄴ', '③ ㄷ' 처럼 번호와 기호를 함께 써라.\n"
            f"[Paddle 시작]\n{paddle_text}\n[Paddle 끝]"
        )
      
    else:
        desc = {"text": "지문/본문", "choice": "선지(보기)", "code": "코드/SQL"}.get(kind, "텍스트")
        system_prompt = (
            "너는 시험지 OCR 결과를 보정하는 어시스턴트이다.\n"
            "이미지 내용과 Paddle 결과를 참고해 최종 텍스트를 정확하게 만든다.\n"
            "절대로 '최종 텍스트는 ...' 같은 설명 문장을 쓰지 마라.\n"
            "코드/SQL은 필요하면 ```sql 코드블록으로만 출력해라."
        )
        user_text = (
            f"이미지 안에는 {desc}가 들어있다.\n"
            "Paddle 결과는 참고만 하고, 틀린 부분은 이미지 기준으로 수정해라.\n"
            f"[Paddle 시작]\n{paddle_text}\n[Paddle 끝]"
        )

    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    {"type": "text", "text": user_text},
                ],
            },
        ],
    )
    return _extract_text_from_openai_message(resp.choices[0].message)


def strip_gpt_boilerplate(text: str) -> str:
    text = (text or "").strip()
    if not text:
        return ""
    lines = text.splitlines()

    def is_boilerplate(line: str) -> bool:
        line = line.strip()
        if not line:
            return True
        return (
            "최종 텍스트는" in line
            or "수정되었습니다" in line
            or ("다음은" in line and "텍스트" in line)
        )

    while lines and is_boilerplate(lines[0]):
        lines.pop(0)
    return "\n".join(lines).strip()


def extract_first_code_block(text: str) -> str | None:
    m = re.search(r"```(?:sql|SQL|plaintext)?\s*([\s\S]*?)```", text)
    if m:
        return m.group(1).strip()
    return None


def normalize_text_for_kind(kind: str, raw: str) -> str:
    text = strip_gpt_boilerplate(raw)
    if not text:
        return ""

    if kind == "code":
        inner = extract_first_code_block(text)
        if inner is not None:
            return f"```sql\n{inner}\n```"
        return f"```sql\n{text}\n```"

    if kind == "choice":
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n".join(lines)

    if kind == "qnum":
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return "\n".join(lines)

    if text.lstrip().startswith("```"):
        inner = extract_first_code_block(text)
        if inner is not None:
            text = inner

    lines = [line.rstrip() for line in text.splitlines()]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()

    return "\n".join(lines)


def build_reading_text(kind: str, raw: str) -> str:
    if kind == "chart":
        return "차트 이미지가 있습니다. 원본 이미지를 확인해 주세요."
    if kind == "table":
        return "표 이미지가 있습니다. 원본 이미지를 확인해 주세요."
    return normalize_text_for_kind(kind, raw)


def run_hybrid_ocr_on_seq_meta(seq_meta):
    for q in seq_meta:
        for item in q["items"]:
            kind = item["kind"]
            path = item["path"]
            if kind not in TEXTUAL_CLASSES:
                continue

            crop = cv2.imread(path)
            if kind == "code":
                crop_for_paddle = enhance_for_code(crop)
            elif kind == "choice":
                crop_for_paddle = enhance_for_choice(crop)
            else:
                crop_for_paddle = enhance_for_ocr(crop)

            paddle_text = paddle_ocr_with_newlines(crop_for_paddle)
            gpt_text = hybrid_gpt_vision_with_paddle(path, paddle_text, kind=kind)
            item["gpt_hybrid_text"] = gpt_text

    return seq_meta


# ==============================
# 6. 최종 JSON 생성
# ==============================

def build_exam_json_for_views(seq_meta_hybrid,
                              img_bgr: np.ndarray,
                              output_dir: str,
                              base_url: str | None = None) -> Dict[str, Any]:
    full_h, full_w = img_bgr.shape[:2]
    questions = []

    for q in seq_meta_hybrid:
        qnum = q.get("question_number")
        items_src = q["items"]

        all_bboxes = [it["bbox"] for it in items_src]
        x1 = min(b[0] for b in all_bboxes)
        y1 = min(b[1] for b in all_bboxes)
        x2 = max(b[2] for b in all_bboxes)
        y2 = max(b[3] for b in all_bboxes)

        pad = 20
        x1 = max(0, x1 - pad)
        y1 = max(0, y1 - pad)
        x2 = min(full_w, x2 + pad)
        y2 = min(full_h, y2 + pad)

        q_crop = img_bgr[y1:y2, x1:x2]
        qnum_safe = qnum if qnum is not None else "unknown"
        q_full_filename = f"q{qnum_safe}_full.png"
        q_full_path = os.path.join(output_dir, q_full_filename)
        cv2.imwrite(q_full_path, q_crop)

        if base_url:
            q_full_url = base_url.rstrip("/") + "/" + q_full_filename
        else:
            q_full_url = q_full_path

        q_items = []
        for item in items_src:
            img_path = item["path"]
            filename = os.path.basename(img_path)
            image_url = base_url.rstrip("/") + "/" + filename if base_url else img_path
            kind = item["kind"]
            raw = item.get("gpt_hybrid_text", "") or ""
            display_text = build_reading_text(kind, raw)
            q_items.append(
                {
                    "kind": kind,
                    "imagePath": image_url,
                    "displayText": display_text,
                }
            )

        # qnum 텍스트에서 문제 번호 재추출
        for it in q_items:
            if it["kind"] == "qnum":
                src = it["displayText"]
                m = re.search(r"\d+", src)
                if m:
                    qnum = int(m.group(0))
                break

        questions.append(
            {
                "questionNumber": qnum,
                "questionImagePath": q_full_url,
                "items": q_items,
            }
        )

    return {"questions": questions}


# ==============================
# 7. public API
# ==============================

def process_exam(
    image_path: str,
    output_dir: str,
    base_url: str | None = None,
) -> Dict[str, Any]:
    """
    메인 엔트리:
    - image_path: 시험지 (또는 세로로 합친 이미지) 경로
    - output_dir: 결과 PNG + JSON 저장 폴더
    - base_url : 프론트에서 접근할 이미지 URL prefix (옵션)
    """
    os.makedirs(output_dir, exist_ok=True)

    img_bgr, all_boxes = detect_boxes_with_roboflow(image_path)
    structured_questions = build_structured_questions(img_bgr, all_boxes)
    seq_meta = build_sequential_crops(structured_questions, img_bgr, output_dir)
    seq_meta_hybrid = run_hybrid_ocr_on_seq_meta(seq_meta)
    exam_json = build_exam_json_for_views(seq_meta_hybrid, img_bgr, output_dir, base_url)

    # JSON 파일 저장
    out_path = os.path.join(output_dir, "exam_questions.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(exam_json, f, ensure_ascii=False, indent=2)

    # 호출한 쪽에서 사용할 수 있도록 경로도 같이 리턴
    exam_json["_output_path"] = out_path
    return exam_json


# ==============================
# 8. CLI 엔트리
# ==============================

if __name__ == "__main__":
    # 간단 실행 예시:
    #   python -m exam_ocr.pipeline examples/test-1.jpg
    import sys

    if len(sys.argv) < 2:
        print("Usage: python -m exam_ocr.pipeline <image_path> [output_dir]")
        sys.exit(1)

    img_path = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) >= 3 else "exam_outputs"

    result = process_exam(img_path, out_dir, base_url=None)

    # ✅ 실제 결과값만 출력
    print("=== Exam OCR 완료 ===")
    print(f"JSON 경로: {result['_output_path']}")
    print(f"문항 수: {len(result['questions'])}")
