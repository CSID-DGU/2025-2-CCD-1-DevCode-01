import os
import time
import uuid
import shutil
import traceback
from ai_exam_ocr.pipeline.pipeline import process_exam

AI_BASE_URL = os.getenv("AI_BASE_URL")

def cleanup():
    now = time.time()

    if not os.path.exists("exam_temp"):
        return

    for uid_folder in os.listdir("exam_temp"):
        uid_path = os.path.join("exam_temp", uid_folder)

        if not os.path.isdir(uid_path):
            continue

        for session_folder in os.listdir(uid_path):
            session_path = os.path.join(uid_path, session_folder)

            try:
                last_modified = os.path.getmtime(session_path)
            except Exception:
                continue

            if now - last_modified > 28800:
                print(f"[CLEANUP] Removing expired exam folder: {session_path}")
                shutil.rmtree(session_path, ignore_errors=True)


def run_exam_ocr(img_path: str, output_dir: str, user_id: str, now_str: str):
    try:
        # OCR 실행
        exam_json = process_exam(
            image_path=img_path,
            output_dir=output_dir,
            base_url=None,
            save_json=False
        )

        # URL 변환
        for q in exam_json.get("questions", []):
            q_img = q.get("questionImagePath")
            if q_img:
                fn = os.path.basename(q_img)
                q["questionImagePath"] = f"{AI_BASE_URL}/exam_images/{user_id}/{now_str}/{fn}"

            for item in q.get("items", []):
                item_img = item.get("imagePath")
                if item_img:
                    fn = os.path.basename(item_img)
                    item["imagePath"] = f"{AI_BASE_URL}/exam_images/{user_id}/{now_str}/{fn}"

        return exam_json

    except Exception as e:
        traceback.print_exc()
        raise
