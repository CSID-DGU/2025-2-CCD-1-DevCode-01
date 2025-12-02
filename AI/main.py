from fastapi import FastAPI, Request 
from ai_file_ocr.router import router as file_ocr_router
from ai_lecture_ocr.router import router as lecture_ocr_router
from ai_exam_ocr.src.router import router as exam_ocr_router
import traceback

app = FastAPI(title="AI OCR Server")

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        print("🔥🔥🔥 EXCEPTION CAUGHT 🔥🔥🔥")
        traceback.print_exc()  
        raise e
    
# 각 모듈의 라우터 연결
app.include_router(file_ocr_router)
app.include_router(lecture_ocr_router)
app.include_router(exam_ocr_router)