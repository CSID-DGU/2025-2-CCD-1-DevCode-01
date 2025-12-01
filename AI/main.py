from fastapi import FastAPI, Request
from ai_file_ocr.router import router as file_ocr_router
from ai_lecture_ocr.router import router as lecture_ocr_router
from ai_exam_ocr.router import router as exam_ocr_router


app = FastAPI(title="AI OCR Server")

# 각 모듈의 라우터 연결
app.include_router(file_ocr_router)
app.include_router(lecture_ocr_router)
app.include_router(exam_ocr_router)