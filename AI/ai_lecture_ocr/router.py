from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import base64, tempfile

from .ocr_pipeline.rapid_ocr_blocks import process_page
from .ocr_pipeline.llm_postprocess import call_gpt_from_blocks

router = APIRouter()

class BoardOcrRequest(BaseModel):
    image_base64: str


@router.post("/ocr/board")
def board_ocr(request: BoardOcrRequest):
    try:
        img_bytes = base64.b64decode(request.image_base64)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp:
            tmp.write(img_bytes)
            tmp.flush()
            img_path = tmp.name

        page = process_page(img_path)
        text = call_gpt_from_blocks(page["blocks"])

        return {"text": text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR 실패: {e}")
