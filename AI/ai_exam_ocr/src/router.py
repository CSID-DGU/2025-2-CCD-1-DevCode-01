import os
import uuid
import shutil
import tempfile
import traceback

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from dotenv import load_dotenv
import boto3

from ai_exam_ocr.src.exam_ocr.pipeline import process_exam

load_dotenv()

router = APIRouter(
    prefix="/exam",
    tags=["Exam OCR"]
)

# S3 설정
S3_EXAM_BUCKET = os.getenv("AWS_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION")

s3_client = boto3.client("s3", region_name=AWS_REGION)

if not S3_EXAM_BUCKET:
    raise RuntimeError("AWS_BUCKET_NAME이 설정되지 않았습니다.")


def upload_s3(local_path: str, key_prefix: str) -> str:
    filename = os.path.basename(local_path)
    key = f"exam/{key_prefix}/{filename}"

    s3_client.upload_file(
        local_path,
        key,
        ExtraArgs={"ContentType": "image/png"}   
    )


    return f"https://{S3_EXAM_BUCKET}.s3.amazonaws.com/{key}"


@router.post("/ocr/")
async def exam_ocr_api(image: UploadFile = File(...)):

    if not image:
        raise HTTPException(400, "이미지를 업로드하세요.")

    ext = os.path.splitext(image.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png"]:
        raise HTTPException(400, "jpg/png 파일만 지원")

    tmp_root = tempfile.mkdtemp(prefix="exam_")
    uid = uuid.uuid4().hex

    img_path = os.path.join(tmp_root, f"input_{uid}{ext}")
    out_dir = os.path.join(tmp_root, "out")

    try:
        # 업로드된 파일 temp에 저장
        with open(img_path, "wb") as f:
            shutil.copyfileobj(image.file, f)

        # OCR 수행
        exam_json = process_exam(
            image_path=img_path,
            output_dir=out_dir,
            base_url=None,
            save_json=False  
        )

        # crop 이미지 → S3 업로드 → URL로 변환
        questions = exam_json.get("questions", [])

        for q in questions:
            q_img = q.get("questionImagePath")
            if q_img:
                q["questionImagePath"] = upload_s3(
                    q_img,
                    key_prefix=f"questions/{uid}"
                )

            for item in q.get("items", []):
                item_img = item.get("imagePath")
                if item_img:
                    item["imagePath"] = upload_s3(
                        item_img,
                        key_prefix=f"items/{uid}"
                    )

        exam_json["questions"] = questions

        return JSONResponse(content=exam_json)

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"OCR 처리 실패: {e}")

    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)
