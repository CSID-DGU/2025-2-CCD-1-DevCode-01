import os
import glob
import argparse
import json
from typing import List, Dict


import numpy as np
import torch
import torchvision
from PIL import Image
from tqdm import tqdm
import cv2

from campusmate_ai.gdino_utils import (
    load_model,
    preprocess_image,
    infer_image,
    load_prompts,
    draw_and_save_with_util,
    to_pixel_boxes,
    enhance_for_tables,  
    preprocess_np_for_gdino
)
from campusmate_ai.router.region_router import enrich_detections

# ---------------------- ROI / 분석 유틸 ----------------------
def get_roi_np(image_src, bbox):
    """입력 이미지에서 bbox(x1,y1,x2,y2) 영역을 numpy array로 추출"""
    if isinstance(image_src, Image.Image):
        arr = np.array(image_src)
    else:
        arr = np.array(image_src)
    x1, y1, x2, y2 = list(map(int, bbox))
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(arr.shape[1] - 1, x2), min(arr.shape[0] - 1, y2)
    return arr[y1:y2, x1:x2].copy()

def bbox_area(b):
    x1, y1, x2, y2 = map(float, b)
    return max(0.0, x2 - x1) * max(0.0, y2 - y1)



def measure_text_density(reader, roi: np.ndarray):
    """
    텍스트 밀도(0~1), 문자수, 평균 신뢰도 반환.
    작은 ROI 업스케일 + 이진화로 OCR 안정화.
    return: (density, char_count, avg_conf)
    """
    if reader is None or roi.size == 0:
        return 0.0, 0, 0.0

    h, w = roi.shape[:2]
    # 1) 작은 ROI 업스케일
    if max(h, w) < 64:
        scale = 2.0 if max(h, w) >= 32 else 3.0
        roi = cv2.resize(roi, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
        h, w = roi.shape[:2]

    # 2) 대비 보정 + 이진화
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 5, 50, 50)
    _ = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 8
    )

    # 3) OCR
    try:
        results = reader.readtext(roi, detail=1, paragraph=False)
    except Exception:
        return 0.0, 0, 0.0

    cover = 0.0
    chars, confs = 0, []
    for r in results:
        if len(r) < 3:
            continue
        quad, text, conf = r[0], (r[1] or "").strip(), float(r[2] or 0.0)
        xs = [pt[0] for pt in quad]
        ys = [pt[1] for pt in quad]
        x1, y1, x2, y2 = int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w - 1, x2), min(h - 1, y2)
        area = max(0, (x2 - x1)) * max(0, (y2 - y1))
        cover += area
        if text:
            chars += len(text)
            confs.append(conf)

    density = float(cover / (w * h + 1e-6))
    avg_conf = float(np.mean(confs)) if confs else 0.0
    return density, chars, avg_conf


def edge_score(roi: np.ndarray) -> float:
    if roi.size == 0:
        return 0.0
    h, w = roi.shape[:2]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    k = 3 if max(h, w) < 64 else 1
    if k > 1:
        gray = cv2.GaussianBlur(gray, (k | 1, k | 1), 0)
    edges = cv2.Canny(gray, 80, 160)
    return float((edges > 0).sum()) / float(edges.size + 1e-6)


def split_by_contours(roi: np.ndarray, min_area_ratio: float = 0.04) -> list:
    """도형/텍스트 섞인 큰 박스를 내부 컨투어로 세분화"""
    if roi.size == 0:
        return []
    h, w = roi.shape[:2]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 160)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    dil = cv2.dilate(edges, kernel, iterations=1)  # 과병합 방지
    cnts, _ = cv2.findContours(dil, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = []
    for c in cnts:
        x, y, bw, bh = cv2.boundingRect(c)
        if bw * bh < min_area_ratio * w * h:
            continue
        out.append([x, y, x + bw, y + bh])
    return out


def detect_axes_like(roi: np.ndarray, return_score: bool = False):
    """
    그래프 축 비슷한 긴 직선을 찾으면 True (또는 점수 반환)
    - 긴 수평/수직 선의 개수를 세서 축 유사도(0~1 근사)를 계산
    """
    if roi.size == 0:
        return False if not return_score else 0.0

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 80, 160)

    # 작은 노이즈 제거
    h, w = roi.shape[:2]
    min_len = max(min(h, w) // 6, 30)
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=40,
        minLineLength=min_len,
        maxLineGap=12,
    )
    if lines is None:
        return False if not return_score else 0.0

    horiz = vert = 0
    for x1, y1, x2, y2 in lines[:, 0, :]:
        if abs(y1 - y2) < 3:  # 수평선
            horiz += 1
        elif abs(x1 - x2) < 3:  # 수직선
            vert += 1

    # 축 유사도 점수 계산 (0~1)
    total = horiz + vert
    score = min(1.0, total / 10.0)  # 선이 많을수록 1에 근접
    if return_score:
        return score
    else:
        return (horiz >= 1 and vert >= 1)



def gridness_score(roi: np.ndarray) -> float:
    """격자성 점수(0~1 근사)"""
    if roi.size == 0:
        return 0.0
    g = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    e = cv2.Canny(g, 80, 160)
    lines = cv2.HoughLinesP(
        e, 1, np.pi / 180, threshold=90, minLineLength=min(roi.shape[:2]) // 5, maxLineGap=6
    )
    if lines is None:
        return 0.0
    horiz = sum(1 for x1, y1, x2, y2 in lines[:, 0, :] if abs(y1 - y2) < 3)
    vert = sum(1 for x1, y1, x2, y2 in lines[:, 0, :] if abs(x1 - x2) < 3)
    tot = max(1, horiz + vert)
    return min(1.0, tot / 40.0)


# ---------------------- 시각화 (리파인 결과) ----------------------
def draw_refined_visual(image_src, dets, out_path: str):
    """리파인된 박스들을 카테고리별 색으로 시각화"""
    if isinstance(image_src, Image.Image):
        img = np.array(image_src)[:, :, ::-1].copy()  # BGR
    else:
        img = image_src.copy()
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    colors = {
        "text": (50, 200, 255),
        "chart": (0, 170, 0),
        "table": (0, 0, 220),
        "formula": (200, 50, 200),
        "diagram": (255, 140, 0),
    }

    for d in dets:
        x1, y1, x2, y2 = [int(v) for v in d["bbox"]]
        cat = d.get("category", "text")
        color = colors.get(cat, (180, 180, 180))
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
        label = f'{cat} {d.get("score", 0):.2f}'
        tw, th = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
        cv2.rectangle(img, (x1, max(0, y1 - th - 6)), (x1 + tw + 8, y1), color, -1)
        cv2.putText(
            img,
            label,
            (x1 + 4, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (255, 255, 255),
            1,
            cv2.LINE_AA,
        )

    os.makedirs(os.path.dirname(out_path), exist_ok=True
                )
    cv2.imwrite(out_path, img)


# ---------------------- 기존 유틸 ----------------------
def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    inter_w = max(0, min(ax2, bx2) - max(ax1, bx1))
    inter_h = max(0, min(ay2, by2) - max(ay1, by1))
    inter = inter_w * inter_h
    ua = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter + 1e-6
    return inter / ua


def nms_by_cat(items: List[Dict], iou_thr: float = 0.5) -> List[Dict]:
    out = []
    for cat in set(d["category"] for d in items):
        cur = [d for d in items if d["category"] == cat]
        if not cur:
            continue
        boxes = torch.tensor([d["bbox"] for d in cur], dtype=torch.float32)
        scores = torch.tensor([d["score"] for d in cur], dtype=torch.float32)
        keep = torchvision.ops.nms(boxes, scores, iou_thr).tolist()
        out += [cur[i] for i in keep]
    return out


def get_wh(image_src):
    if isinstance(image_src, Image.Image):
        return image_src.size
    arr = np.array(image_src)
    H, W = arr.shape[:2]
    return W, H


def crop_from_image(image_src, bbox):
    if isinstance(image_src, Image.Image):
        return image_src.crop(tuple(map(int, bbox)))
    arr = np.array(image_src)
    pil = Image.fromarray(arr)
    return pil.crop(tuple(map(int, bbox)))


def easyocr_detect_text_boxes(image_src, reader, min_area_ratio, W, H):
    arr = np.array(image_src)
    results = reader.readtext(arr, detail=1, paragraph=False)
    boxes = []
    for r in results:
        if len(r) < 2:
            continue
        quad = r[0]
        xs = [pt[0] for pt in quad]
        ys = [pt[1] for pt in quad]
        x1, y1, x2, y2 = float(min(xs)), float(min(ys)), float(max(xs)), float(max(ys))
        area = (x2 - x1) * (y2 - y1)
        if area < min_area_ratio * W * H:
            continue
        boxes.append([x1, y1, x2, y2])
    return boxes


# ---------------------- 레이아웃 리파인 ----------------------
def refine_layout_boxes(image_src, dets, reader, page_W, page_H):
    """
    1) 큰 박스 분할  2) 혼재 추정 시 세분화  3) 하위 박스 재분류
    + gridness 기반으로 text→table 승격 규칙 강화
    """
    MIN_AREA_RATIO = 0.01
    dets = [d for d in dets if bbox_area(d["bbox"]) / (page_W * page_H + 1e-6) > MIN_AREA_RATIO]
    PAGE_AREA = page_W * page_H
    BIG_BOX = 0.40
    TINY_BOX = 0.02
    TEXT_CHAR_MIN = 2
    CONF_MIN = 0.35

    GRID_TABLE_THR = 0.16  # 낮춰서 얇은 그리드 회수
    TEXT_DENSE_MAX_FOR_TABLE = 0.24

    out = []

    for d in dets:
        x1, y1, x2, y2 = map(int, d["bbox"])
        w, h = max(1, x2 - x1), max(1, y2 - y1)
        area_ratio = (w * h) / (PAGE_AREA + 1e-6)

        roi = get_roi_np(image_src, [x1, y1, x2, y2])
        tden, tchars, tconf = measure_text_density(reader, roi)
        esc = edge_score(roi)
        orig_cat = d["category"]
        orig_score = float(d.get("score", 0.0))
        gscore = gridness_score(roi)

        # easyocr 상위 박스거나, 작은 박스에서 글자 감지되면 텍스트 고정
        if (d.get("raw_label") == "easyocr_text") or (
            area_ratio <= TINY_BOX
            and (tchars >= TEXT_CHAR_MIN or tconf >= CONF_MIN)
        ):
            out.append(
                {
                    **d,
                    "category": "text",
                    "text_density": tden,
                    "edge_score": esc,
                    "refined": True,
                }
            )
            continue

        # 신규: gridness 기반 테이블 승격
        if gscore >= GRID_TABLE_THR and tden <= TEXT_DENSE_MAX_FOR_TABLE:
            orig_cat = "table"

        # 보존/락 규칙
        if orig_cat in {"chart", "table"} and (orig_score >= 0.24) and (tden < 0.20):
            out.append(
                {
                    **d,
                    "category": orig_cat,
                    "text_density": tden,
                    "edge_score": esc,
                    "gridness": gscore,
                    "refined": False,
                }
            )
            continue

        # 축 감지 → 차트
        c = orig_cat
        if c != "table" and detect_axes_like(roi):
            c = "chart"

        # 혼재 & 큰 박스 → 내부 분할
        mixed = (esc > 0.12 and tden > 0.08)
        if area_ratio > BIG_BOX and mixed:
            sub_boxes = split_by_contours(roi, min_area_ratio=0.03)
            if not sub_boxes:
                out.append(
                    {**d, "category": c, "text_density": tden, "edge_score": esc}
                )
                continue

            for sb in sub_boxes:
                sx1, sy1, sx2, sy2 = sb
                sb_abs = [sx1 + x1, sy1 + y1, sx2 + x1, sy2 + y1]
                sub_roi = get_roi_np(image_src, sb_abs)
                sub_tden, sub_tchars, sub_tconf = measure_text_density(reader, sub_roi)
                sub_esc = edge_score(sub_roi)
                sub_g = gridness_score(sub_roi)

                if ((sx2 - sx1) * (sy2 - sy1)) / (PAGE_AREA + 1e-6) <= TINY_BOX:
                    if sub_tchars >= TEXT_CHAR_MIN or sub_tconf >= CONF_MIN:
                        sub_cat = "text"
                    else:
                        sub_cat = (
                            "table"
                            if sub_g >= GRID_TABLE_THR
                            and sub_tden <= TEXT_DENSE_MAX_FOR_TABLE
                            else ("chart" if detect_axes_like(sub_roi) else "diagram")
                        )
                elif sub_g >= GRID_TABLE_THR and sub_tden <= TEXT_DENSE_MAX_FOR_TABLE:
                    sub_cat = "table"
                else:
                    sub_cat = (
                        "chart" if detect_axes_like(sub_roi) else "diagram"
                    )

                out.append(
                    {
                        **d,
                        "bbox": [float(v) for v in sb_abs],
                        "category": sub_cat,
                        "score": float(d["score"] * 0.95),
                        "text_density": sub_tden,
                        "edge_score": sub_esc,
                        "gridness": sub_g,
                        "refined": True,
                    }
                )
            continue

        out.append(
            {
                **d,
                "category": c,
                "text_density": tden,
                "edge_score": esc,
                "gridness": gscore,
            }
        )

    refined = nms_by_cat(out, iou_thr=0.5)
    return refined


# ---------------------- 직렬화 ----------------------
def to_py(obj):
    if isinstance(obj, dict):
        return {k: to_py(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [to_py(x) for x in obj]
    if isinstance(obj, (np.floating, np.integer)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if torch.is_tensor(obj):
        t = obj.detach().cpu()
        return t.item() if t.ndim == 0 else t.tolist()
    return obj


# ---------------------- Main ----------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--prompts", default=os.path.join(os.path.dirname(__file__), "prompts.yaml"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "outputs"))
    ap.add_argument("--box_thr", type=float, default=0.25)
    ap.add_argument("--txt_thr", type=float, default=0.25)
    ap.add_argument("--enable_text_ocr", action="store_true")
    ap.add_argument("--ocr_langs", default="ko,en")
    args = ap.parse_args()

    cfg = load_prompts(args.prompts)
    model, device = load_model()

    if os.path.isdir(args.input):
        paths = sorted(
            [
                p
                for p in glob.glob(os.path.join(args.input, "*"))
                if p.lower().endswith((".jpg", ".jpeg", ".png"))
            ]
        )
    else:
        paths = [args.input]

    os.makedirs(os.path.join(args.out, "vis"), exist_ok=True)
    os.makedirs(os.path.join(args.out, "json"), exist_ok=True)
    os.makedirs(os.path.join(args.out, "crops"), exist_ok=True)

    reader = None
    if args.enable_text_ocr:
        import easyocr

        langs = [s.strip() for s in args.ocr_langs.split(",") if s.strip()]
        reader = easyocr.Reader(langs, gpu=False)

    # 라벨 매핑 키워드(보강)
    table_keys = [
        "table",
        "grid",
        "spreadsheet",
        "matrix",
        "rows and columns",
        "grid of cells",
        "gridlines",
        "header row",
    ]
    chart_keys = ["chart", "graph", "plot", "axis", "axes", "bar", "line", "pie", "legend"]

    for p in tqdm(paths, desc="Processing"):
        image_src, image = preprocess_image(p)

        # ===== 1패스: 전체 프롬프트 =====
        boxes1, scores1, labels1 = infer_image(
            model, image, cfg["prompt"], cfg["box_thr"], cfg["txt_thr"], device
        )

        # ===== 2패스: 테이블 전용(전처리 이미지) =====
        table_np = enhance_for_tables(image_src) 
        table_image = preprocess_np_for_gdino(table_np)
        boxes2, scores2, labels2 = infer_image(
            model, table_image, cfg["table_prompt"], 0.20, 0.20, device
        )

        # 병합
        boxes = np.concatenate([boxes1, boxes2], axis=0)
        scores = np.concatenate([scores1, scores2], axis=0)
        labels = list(labels1) + list(labels2)

        stem = os.path.splitext(os.path.basename(p))[0]

        # (A) 원본 DINO 결과 시각화(비교용)
        raw_vis_path = os.path.join(args.out, "vis", f"{stem}_raw.jpg")
        draw_and_save_with_util(image_src, boxes, scores, labels, raw_vis_path)

        # DINO → 픽셀 좌표 & 1차 카테고리 매핑
        pboxes = to_pixel_boxes(image_src, boxes)
        dets = []
        for b, s, l in zip(pboxes, scores, labels):
            L = l.lower().strip()
            if any(k in L for k in table_keys):
                cat = "table"
            elif any(k in L for k in chart_keys):
                cat = "chart"
            elif any(
                k in L
                for k in [
                    "formula",
                    "equation",
                    "math",
                    "integral",
                    "sigma",
                    "sqrt",
                    "fraction",
                    "latex",
                ]
            ):
                cat = "formula"
            elif any(k in L for k in ["diagram", "schematic", "figure", "arrow"]):
                cat = "diagram"
            else:
                cat = "text"

            if l == "easyocr_text":
                cat = "text"

            dets.append(
                {"bbox": [float(v) for v in b], "score": float(s), "raw_label": l, "category": cat}
            )

        W, H = get_wh(image_src)
        dets = nms_by_cat(dets, 0.5)

        # fallback: 텍스트 감지 전무 시 EasyOCR 보강
        if reader:
            text_count = sum(1 for d in dets if d["category"] == "text")
            if text_count == 0:
                fb_boxes = easyocr_detect_text_boxes(image_src, reader, 0.001, W, H)
                for b in fb_boxes:
                    dets.append(
                        {"bbox": b, "score": 0.3, "raw_label": "easyocr_text", "category": "text"}
                    )

        # (B) 세분화/재분류 후처리
        dets = refine_layout_boxes(image_src, dets, reader, W, H)
        dets = enrich_detections(image_src, dets, out_dir_crops=os.path.join(args.out, "crops"))

        # (C) 리파인 결과 시각화
        ref_vis_path = os.path.join(args.out, "vis", f"{stem}_refined.jpg")
        draw_refined_visual(image_src, dets, ref_vis_path)

        # 저장(JSON)
        payload = {"detections": dets}
        with open(os.path.join(args.out, "json", f"{stem}.json"), "w", encoding="utf-8") as f:
            json.dump(to_py(payload), f, ensure_ascii=False, indent=2)

        md_lines = []
        for d in dets:
            if d["category"] == "chart" and d.get("description"):
                md_lines.append(f"**[차트]** {d['description']}")
            elif d["category"] == "formula" and d.get("latex"):
                md_lines.append(f"**[수식]** `$${d['latex']}$$`")
            elif d["category"] == "text" and d.get("text"):
                md_lines.append(d["text"])
        with open(os.path.join(args.out, "json", f"{stem}.md"), "w", encoding="utf-8") as f:
            f.write("\n\n".join(md_lines))    


if __name__ == "__main__":
    main()
