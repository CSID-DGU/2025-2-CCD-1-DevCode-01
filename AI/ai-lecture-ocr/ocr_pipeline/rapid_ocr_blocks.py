import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR
import re
import statistics

ocr = RapidOCR(det_use_cuda=False, rec_use_cuda=False)

def load_and_resize(img_path: str, max_side: int = 1600):
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(img_path)

    h, w = img.shape[:2]
    scale = max_side / max(h, w)
    if scale < 1:  
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = cv2.resize(img, (new_w, new_h))
    return img


def run_ocr(img):
    out = ocr(img)
    if not out:
        return []

    if isinstance(out, tuple) and len(out) == 2:
        ocr_result, _ = out
    else:
        ocr_result = out

    if not ocr_result:
        return []

    results = []

    for item in ocr_result:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue

        box = item[0]
        text = item[1]
        score = float(item[2]) if len(item) >= 3 else 1.0

        # 너무 낮은 신뢰도 / 작은 박스는 제외
        if score < 0.5:
            continue

        pts = np.array(box).reshape(-1, 2)
        xs = pts[:, 0]
        ys = pts[:, 1]
        x1, y1 = float(xs.min()), float(ys.min())
        x2, y2 = float(xs.max()), float(ys.max())
        w, h = x2 - x1, y2 - y1

        if w < 8 or h < 8:
            continue

        results.append(
            {
                "text": str(text),
                "confidence": score,
                "bbox": [int(x1), int(y1), int(x2), int(y2)],
            }
        )

    return results


def reading_order(boxes):
    if not boxes:
        return []

    # 1) 위→아래 정렬
    boxes_sorted = sorted(boxes, key=lambda b: (b["bbox"][1], b["bbox"][0]))

    # 2) y 오버랩 기반으로 줄(line) 묶기
    lines = []
    cur = [boxes_sorted[0]]

    for b in boxes_sorted[1:]:
        prev = cur[-1]
        py1, py2 = prev["bbox"][1], prev["bbox"][3]
        by1, by2 = b["bbox"][1], b["bbox"][3]

        overlap = min(py2, by2) - max(py1, by1)
        avg_h = (py2 - py1 + by2 - by1) / 2

        if overlap > avg_h * 0.1:
            cur.append(b)
        else:
            lines.append(cur)
            cur = [b]
    lines.append(cur)

    # 3) 줄 단위 bbox / center / height 계산
    enriched_lines = []
    all_heights, all_y1, all_y2, all_x1, all_x2 = [], [], [], [], []

    for line in lines:
        xs1 = [b["bbox"][0] for b in line]
        ys1 = [b["bbox"][1] for b in line]
        xs2 = [b["bbox"][2] for b in line]
        ys2 = [b["bbox"][3] for b in line]

        x1 = min(xs1)
        y1 = min(ys1)
        x2 = max(xs2)
        y2 = max(ys2)

        text = " ".join(b["text"] for b in sorted(line, key=lambda bb: bb["bbox"][0]))
        height = y2 - y1
        cx = (x1 + x2) / 2
        cy = (y1 + y2) / 2

        enriched_lines.append(
            {
                "text": text,
                "line_boxes": line,
                "bbox": [x1, y1, x2, y2],
                "center_x": cx,
                "center_y": cy,
                "height": height,
                "role": "body",
            }
        )

        all_heights.append(height)
        all_y1.append(y1)
        all_y2.append(y2)
        all_x1.append(x1)
        all_x2.append(x2)

    # 4) 페이지 크기 추정
    page_x1 = min(all_x1)
    page_x2 = max(all_x2)
    page_y1 = min(all_y1)
    page_y2 = max(all_y2)
    page_height = page_y2 - page_y1
    page_width = page_x2 - page_x1

    # 5) 제목 후보 감지
    try:
        median_h = statistics.median(all_heights)
    except statistics.StatisticsError:
        median_h = all_heights[0]

    for ln in enriched_lines:
        h = ln["height"]
        y_top = ln["bbox"][1]
        is_bigger_font = h > median_h * 1.4
        is_top_region = (y_top - page_y1) < page_height * 0.3

        if is_bigger_font and is_top_region:
            ln["role"] = "title"

    # 6) 2컬럼 감지
    body_lines = [ln for ln in enriched_lines if ln["role"] != "title"]
    split_x = None
    if len(body_lines) >= 6:
        x_centers = sorted(l["center_x"] for l in body_lines)
        gaps = [x_centers[i + 1] - x_centers[i] for i in range(len(x_centers) - 1)]
        if gaps:
            max_gap = max(gaps)
            if max_gap > page_width * 0.25:
                idx = gaps.index(max_gap)
                split_x = (x_centers[idx] + x_centers[idx + 1]) / 2

    # 7) 읽기 순서
    ordered = []

    title_lines = [ln for ln in enriched_lines if ln["role"] == "title"]
    title_lines = sorted(title_lines, key=lambda ln: ln["bbox"][1])
    ordered.extend(title_lines)

    other_lines = [ln for ln in enriched_lines if ln["role"] != "title"]

    if split_x is None:
        ordered.extend(sorted(other_lines, key=lambda ln: ln["bbox"][1]))
    else:
        left = [ln for ln in other_lines if ln["center_x"] <= split_x]
        right = [ln for ln in other_lines if ln["center_x"] > split_x]
        left_sorted = sorted(left, key=lambda ln: ln["bbox"][1])
        right_sorted = sorted(right, key=lambda ln: ln["bbox"][1])
        ordered.extend(left_sorted)
        ordered.extend(right_sorted)

    return ordered


def classify_blocks(lines):
    """
    lines: reading_order() 결과

    반환 예:
      [
        {"type": "title", "text": "..."},
        {"type": "paragraph", "text": "..."},
        {"type": "bullet_list", "items": ["...", "..."]},
      ]
    """
    blocks = []
    cur_para = []
    bullet_group = []

    def flush_para():
        nonlocal cur_para
        if cur_para:
            paragraph_text = " ".join(l["text"] for l in cur_para)
            paragraph_text = paragraph_text.strip()
            if paragraph_text:
                blocks.append({"type": "paragraph", "text": paragraph_text})
            cur_para = []

    def flush_bullets():
        nonlocal bullet_group
        if bullet_group:
            blocks.append(
                {
                    "type": "bullet_list",
                    "items": bullet_group[:],
                }
            )
            bullet_group = []

    prev_line = None

    for ln in lines:
        txt = ln["text"].strip()
        if not txt:
            continue

        # 1) 제목
        if ln.get("role") == "title":
            flush_para()
            flush_bullets()
            blocks.append({"type": "title", "text": txt})
            prev_line = ln
            continue

        # 2) bullet 감지 (-, *, • 로 시작)
        is_bullet = bool(re.match(r"^(\s*[-•*]\s+).+", txt))
        if is_bullet:
            flush_para()
            bullet_group.append(txt)
            prev_line = ln
            continue
        else:
            flush_bullets()

        # 3) 문단 간 간격 기반
        if prev_line is not None:
            prev_y1, prev_y2 = prev_line["bbox"][1], prev_line["bbox"][3]
            cur_y1, cur_y2 = ln["bbox"][1], ln["bbox"][3]
            gap = cur_y1 - prev_y2

            prev_h = prev_line["height"]
            cur_h = ln["height"]
            avg_h = (prev_h + cur_h) / 2
            is_new_paragraph_gap = gap > avg_h * 0.8
        else:
            is_new_paragraph_gap = True

        if is_new_paragraph_gap:
            flush_para()
            cur_para.append(ln)
        else:
            cur_para.append(ln)

        prev_line = ln

    flush_bullets()
    flush_para()

    return blocks


def process_page(img_path: str):
    img = load_and_resize(img_path)
    ocr_boxes = run_ocr(img)

    if not ocr_boxes:
        return {"page": img_path, "blocks": []}

    lines = reading_order(ocr_boxes)
    blocks = classify_blocks(lines)

    return {
        "page": img_path,
        "blocks": blocks,
    }
