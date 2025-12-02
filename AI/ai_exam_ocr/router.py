import os
import uuid
import traceback
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, HTTPException
from dotenv import load_dotenv
from ai_exam_ocr.tasks import run_exam_ocr

load_dotenv()
AI_BASE_URL = os.getenv("AI_BASE_URL")
router = APIRouter(
    prefix="/exam",
    tags=["Exam OCR"]
)

@router.post("/ocr")
async def exam_ocr(image: UploadFile = File(...)):

    # 고유 폴더 생성
    uid = uuid.uuid4().hex
    now_str = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

    # exam_temp/<uid>/<timestamp>/
    base_dir = os.path.join("exam_temp", uid, now_str)
    os.makedirs(base_dir, exist_ok=True)

    # 입력 이미지 저장
    ext = os.path.splitext(image.filename)[1]
    img_path = os.path.join(base_dir, f"input{ext}")

    img_bytes = await image.read()
    with open(img_path, "wb") as f:
        f.write(img_bytes)

    try:
        exam_json = run_exam_ocr(
            img_path=img_path,
            output_dir=base_dir,
            user_id=uid,
            now_str=now_str
        )       
        # URL 변환
        for q in exam_json.get("questions", []):
            q_img = q.get("questionImagePath")
            if q_img:
                fn = os.path.basename(q_img)
                q["questionImagePath"] = (
                    f"{AI_BASE_URL}/exam_images/{uid}/{now_str}/{fn}"
                )

            for item in q.get("items", []):
                item_img = item.get("imagePath")
                if item_img:
                    fn = os.path.basename(item_img)
                    item["imagePath"] = (
                        f"{AI_BASE_URL}/exam_images/{uid}/{now_str}/{fn}"
                    )

        return {"questions": exam_json.get("questions", [])}

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"OCR 오류: {e}")
    

