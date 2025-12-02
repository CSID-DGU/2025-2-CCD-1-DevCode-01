from fastapi import FastAPI, Request
from ai_file_ocr.router import router as file_ocr_router
from ai_lecture_ocr.router import router as lecture_ocr_router
from ai_exam_ocr.router import router as exam_ocr_router
from fastapi.staticfiles import StaticFiles
import os
import threading
import time

app = FastAPI(title="AI OCR Server")


os.makedirs("exam_temp", exist_ok=True)
app.mount("/exam_images", StaticFiles(directory="exam_temp"), name="exam_images")

# 각 모듈의 라우터 연결
app.include_router(file_ocr_router)
app.include_router(lecture_ocr_router)
app.include_router(exam_ocr_router)

