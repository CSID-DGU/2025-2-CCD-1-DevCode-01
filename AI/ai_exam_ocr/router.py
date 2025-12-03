import os
import tempfile
import uuid
import traceback
from datetime import datetime
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException
from ai_exam_ocr.tasks import *


router = APIRouter(
    prefix="/exam",
    tags=["Exam OCR"]
)

@router.post("/ocr")
async def exam_ocr(image: UploadFile = File(...)):

    # temp 작업 폴더
    tmp_root = tempfile.mkdtemp(prefix="exam_")
    uid = uuid.uuid4().hex

    ext = os.path.splitext(image.filename)[1] or ".png"
    img_path = os.path.join(tmp_root, f"input{ext}")
    out_dir = os.path.join(tmp_root, "out")
    os.makedirs(out_dir, exist_ok=True)

    try:
        # 이미지 저장
        img_bytes = await image.read()
        with open(img_path, "wb") as f:
            f.write(img_bytes)

        # 파이프라인 실행 (crop 로컬 생성)
        exam_json = process_exam(
            image_path=img_path,
            output_dir=out_dir,
            base_url=None,
            save_json=False,
        )

        # 생성된 모든 crop 파일을 S3 업로드
        for q in exam_json.get("questions", []):
            q_img_path = q.get("questionImagePath")
            if q_img_path and os.path.exists(q_img_path):
                q["questionImagePath"] = upload_s3(q_img_path, f"questions/{uid}")

            for item in q.get("items", []):
                item_path = item.get("imagePath")
                if item_path and os.path.exists(item_path):
                    item["imagePath"] = upload_s3(item_path, f"items/{uid}")

        return {"questions": exam_json.get("questions", [])}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OCR 오류: {e}")

    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)

