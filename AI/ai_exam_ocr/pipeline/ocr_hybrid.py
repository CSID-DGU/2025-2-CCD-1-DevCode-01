# 이미지 한 장을 입력으로 받아 문항 단위 JSON(exam_questions.json)을 생성하는 파이프라인.

import os
import re
import json
from typing import List, Dict, Any

import cv2
from dotenv import load_dotenv
from ai_exam_ocr.src.exam_ocr.detection_layout import detect_boxes_with_roboflow, build_structured_questions
from ai_exam_ocr.src.exam_ocr.ocr_hybrid import run_hybrid_ocr_on_seq_meta, build_reading_text


load_dotenv()

ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY")
MODEL_ID = os.environ.get("ROBOFLOW_MODEL_ID", "ccd-pn4pd/8")

if not ROBOFLOW_API_KEY:
    raise RuntimeError("ROBOFLOW_API_KEY 환경변수를 설정해 주세요.")


# ==============================
# 1. seq_meta 빌더
# ==============================

def sort_by_reading_order(boxes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(boxes, key=lambda b: (b["bbox"][1], b["bbox"][0]))


def build_sequential_crops(structured_questions: List[Dict[str, Any]],
                           img_bgr,
                           output_dir: str) -> List[Dict[str, Any]]:
    """
    structured_questions → 각 문항/요소별 crop 파일 + 메타(seq_meta)
    """
    seq_meta: List[Dict[str, Any]] = []

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

    return seq_meta


# ==============================
# 2. 최종 JSON 생성
# ==============================

def build_exam_json_for_views(seq_meta_hybrid: List[Dict[str, Any]],
                              img_bgr,
                              output_dir: str,
                              base_url: str | None = None) -> Dict[str, Any]:
    full_h, full_w = img_bgr.shape[:2]
    questions: List[Dict[str, Any]] = []

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

        # 전체 문제 크롭 저장
        q_crop = img_bgr[y1:y2, x1:x2]
        qnum_safe = qnum if qnum is not None else "unknown"
        q_full_filename = f"q{qnum_safe}_full.png"
        q_full_path = os.path.join(output_dir, q_full_filename)
        cv2.imwrite(q_full_path, q_crop)

        if base_url:
            q_full_url = base_url.rstrip("/") + "/" + q_full_filename
        else:
            q_full_url = q_full_path

        # 각 요소
        q_items: List[Dict[str, Any]] = []
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

        # qnum displayText에서 문제 번호 재추출
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
# 3. public API
# ==============================

# def process_exam(
#     image_path: str,
#     output_dir: str,
#     base_url: str | None = None,
# ) -> Dict[str, Any]:
#     os.makedirs(output_dir, exist_ok=True)

#     img_bgr, all_boxes = detect_boxes_with_roboflow(image_path, ROBOFLOW_API_KEY, MODEL_ID)
#     structured_questions = build_structured_questions(img_bgr, all_boxes)
#     seq_meta = build_sequential_crops(structured_questions, img_bgr, output_dir)
#     seq_meta_hybrid = run_hybrid_ocr_on_seq_meta(seq_meta)
#     exam_json = build_exam_json_for_views(seq_meta_hybrid, img_bgr, output_dir, base_url)

#     # JSON 파일 저장
#     out_path = os.path.join(output_dir, "exam_questions.json")
#     with open(out_path, "w", encoding="utf-8") as f:
#         json.dump(exam_json, f, ensure_ascii=False, indent=2)

#     exam_json["_output_path"] = out_path
#     return exam_json

def process_exam(
    image_path: str,
    output_dir: str,
    base_url: str | None = None,
    save_json: bool = False, #로컬저장x
) -> Dict[str, Any]:
    os.makedirs(output_dir, exist_ok=True)

    img_bgr, all_boxes = detect_boxes_with_roboflow(image_path, ROBOFLOW_API_KEY, MODEL_ID)
    structured_questions = build_structured_questions(img_bgr, all_boxes)
    seq_meta = build_sequential_crops(structured_questions, img_bgr, output_dir)
    seq_meta_hybrid = run_hybrid_ocr_on_seq_meta(seq_meta)
    exam_json = build_exam_json_for_views(seq_meta_hybrid, img_bgr, output_dir, base_url)

    if save_json:
        out_path = os.path.join(output_dir, "exam_questions.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(exam_json, f, ensure_ascii=False, indent=2)
        exam_json["_output_path"] = out_path

    return exam_json

# ==============================
# 4. CLI 엔트리
# ==============================

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python src/exam_ocr/pipeline.py <image_path> [output_dir]")
        raise SystemExit(1)

    img_path = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) >= 3 else "exam_outputs"

    result = process_exam(img_path, out_dir, base_url=None, save_json=True)

    print("=== Exam OCR 완료 ===")
    print(f"JSON 경로: {result['_output_path']}")
    print(f"문항 수: {len(result['questions'])}")
