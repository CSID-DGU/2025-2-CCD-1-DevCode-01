import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from ai_exam_ocr.src.exam_ocr.pipeline import process_exam
import traceback

router = APIRouter(
    prefix="/exam",
    tags=["Exam OCR"]
)

OUTPUT_ROOT = "exam_outputs"

@router.post("/ocr/")
async def exam_ocr_api(image: UploadFile = File(...)):
    print("🚀 [FastAPI] exam_ocr_api() 호출됨")

    # 1) 이미지 존재 확인
    if not image:
        print("❌ [FastAPI] image 없음")
        raise HTTPException(status_code=400, detail="이미지를 업로드하세요.")

    ext = os.path.splitext(image.filename)[1].lower()
    print(f"📄 [FastAPI] 업로드 파일 확장자: {ext}")

    if ext not in [".jpg", ".jpeg", ".png"]:
        print("❌ [FastAPI] 지원하지 않는 확장자")
        raise HTTPException(status_code=400, detail="이미지 파일만 지원합니다 (jpg/png).")

    # 2) 저장 경로 생성
    os.makedirs(OUTPUT_ROOT, exist_ok=True)
    uid = uuid.uuid4().hex

    img_path = os.path.join(OUTPUT_ROOT, f"input_{uid}{ext}")
    out_dir = os.path.join(OUTPUT_ROOT, f"out_{uid}")

    print(f"📁 [FastAPI] 파일 저장 경로: {img_path}")
    print(f"📁 [FastAPI] 출력 폴더: {out_dir}")

    # 3) 파일을 실제로 쓰기
    try:
        with open(img_path, "wb") as f:
            shutil.copyfileobj(image.file, f)

        print("✅ [FastAPI] 파일 저장 완료")
    except Exception as e:
        print("❌ [FastAPI] 파일 저장 중 오류")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"파일 저장 실패: {e}")

    # 4) OCR pipeline 시작
    print("🔍 [FastAPI] process_exam() 실행 시작")

    try:
        exam_json = process_exam(
            image_path=img_path,
            output_dir=out_dir,
        )
        print("🎉 [FastAPI] process_exam() 실행 성공")
    except Exception as e:
        print("❌ [FastAPI] process_exam() 실행 중 오류 발생")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OCR 처리 실패: {e}")

    print("📤 [FastAPI] JSON 응답 반환 완료")

    return JSONResponse(content=exam_json)
