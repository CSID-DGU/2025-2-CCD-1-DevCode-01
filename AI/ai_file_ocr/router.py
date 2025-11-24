from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl
from ai_file_ocr.tasks import run_pdf_ocr

router = APIRouter()

class PdfOcrRequest(BaseModel):
    doc_id: int
    pdf_base64: str
    callback_url: HttpUrl


class PdfOcrResponse(BaseModel):
    message: str

#BE<>AI api
@router.post("/ocr/pdf", response_model=PdfOcrResponse)
def ocr_pdf(request: PdfOcrRequest):
    try:
        run_pdf_ocr.delay(request.doc_id, request.pdf_base64, str(request.callback_url))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Celery task 등록 실패: {e}")

    return PdfOcrResponse(message="OCR 작업이 큐에 등록되었습니다.")
