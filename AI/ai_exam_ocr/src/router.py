import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from ai_exam_ocr.src.exam_ocr.pipeline import process_exam

router = APIRouter(
    prefix="/exam",
    tags=["Exam OCR"]
)

OUTPUT_ROOT = "exam_outputs"

@router.post("/ocr/")
async def exam_ocr_api(image: UploadFile = File(...)):

    if not image:
        raise HTTPException(status_code=400, detail="이미지를 업로드하세요.")

    ext = os.path.splitext(image.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png"]:
        raise HTTPException(status_code=400, detail="이미지 파일만 지원합니다 (jpg/png).")

    os.makedirs(OUTPUT_ROOT, exist_ok=True)

    uid = uuid.uuid4().hex
    img_path = os.path.join(OUTPUT_ROOT, f"input_{uid}{ext}")
    out_dir = os.path.join(OUTPUT_ROOT, f"out_{uid}")

    with open(img_path, "wb") as f:
        shutil.copyfileobj(image.file, f)

    try:
        exam_json = process_exam(
            image_path=img_path,
            output_dir=out_dir,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR 처리 실패: {e}")

    return JSONResponse(content=exam_json)
