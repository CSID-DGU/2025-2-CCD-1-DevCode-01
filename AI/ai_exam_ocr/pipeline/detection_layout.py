# Roboflow + qnum 그룹

from typing import List, Dict, Any, Tuple
import re

import cv2
import requests
from ai_exam_ocr.pipeline.ocr_hybrid import enhance_for_ocr, paddle_ocr_with_newlines


# ==============================
# 1. Roboflow 객체 검출
# ==============================

def detect_boxes_with_roboflow(img_path: str,
                               api_key: str,
                               model_id: str) -> Tuple[Any, List[Dict[str, Any]]]:
    img_bgr = cv2.imread(img_path)
    if img_bgr is None:
        raise FileNotFoundError(img_path)

    with open(img_path, "rb") as f:
        resp = requests.post(
            f"https://detect.roboflow.com/{model_id}?api_key={api_key}&format=json",
            files={"file": f},
        )

    data = resp.json()
    preds = data.get("predictions", [])

    all_boxes: List[Dict[str, Any]] = []
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
# 2. qnum 정제 + 레이아웃 / 문항 묶기
# ==============================

def ocr_qnum_only(img_bgr, bbox) -> Tuple[int | None, str]:
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


def build_structured_questions(img_bgr,
                               all_boxes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Roboflow 박스 전체 → 문항 단위 structured_questions
    """
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
        left_qnums, right_qnums = split_by_mid_x(qnum_boxes, mid_x)  
        left_contents, right_contents = split_by_mid_x(content_boxes, mid_x)

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
