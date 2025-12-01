import os
import uuid
import shutil
import tempfile
import traceback

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from dotenv import load_dotenv
from ai_exam_ocr.tasks import run_exam_ocr
from ai_file_ocr.celery_app import celery_app

load_dotenv()

router = APIRouter(
    prefix="/exam",
    tags=["Exam OCR"]
)

@router.post("/ocr/")
async def exam_ocr_api(image: UploadFile = File(...)):
    if not image:
        raise HTTPException(400, "이미지를 업로드하세요.")

    ext = os.path.splitext(image.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png"]:
        raise HTTPException(400, "jpg/png 파일만 지원합니다.")

    image_bytes = await image.read()
    task = run_exam_ocr.delay(image_bytes, ext)
    return {"task_id": task.id}


@router.get("/result/{task_id}")
async def exam_ocr_result(task_id: str):

    result = celery_app.AsyncResult(task_id)

    if result.state == "FAILURE":
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": str(result.info)}
        )

    if not result.ready():
        return JSONResponse(status_code=204, content=None)

    return JSONResponse(
        status_code=200,
        content=result.result
    )
