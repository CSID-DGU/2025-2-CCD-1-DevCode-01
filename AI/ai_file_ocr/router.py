import traceback
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from ai_file_ocr.tasks import run_pdf_ocr

router = APIRouter()

@router.post("/ocr/pdf")
async def ocr_pdf(
    doc_id: int = Form(...),
    callback_url: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        pdf_bytes = file.file.read()

        if not pdf_bytes:
            raise ValueError("Empty PDF file received")

        run_pdf_ocr.delay(doc_id, pdf_bytes, callback_url)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"message": "OCR 작업이 큐에 등록되었습니다."}
