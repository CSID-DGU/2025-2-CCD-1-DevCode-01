import time
from io import BytesIO 
import os
import requests
import boto3
from dotenv import load_dotenv

from ai_file_ocr.celery_app import celery_app
from ai_file_ocr.pipeline.ocr import pdf_to_images, analyze_page_with_context
from ai_file_ocr.pipeline.summarize import make_mini_summary
from ai_file_ocr.pipeline.memory import ContextMemory  

load_dotenv()
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
AWS_S3_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME")
AWS_S3_REGION = os.getenv("AWS_REGION")


def upload_s3(image_bytes: bytes, key: str, content_type: str = "image/png") -> str:
    s3 = boto3.client(
        "s3",
        region_name=AWS_S3_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
    )
    s3.upload_fileobj(
        Fileobj=BytesIO(image_bytes),
        Bucket=AWS_S3_BUCKET_NAME,
        Key=key,
        ExtraArgs={"ContentType": content_type},
    )
    return f"https://{AWS_S3_BUCKET_NAME}.s3.{AWS_S3_REGION}.amazonaws.com/{key}"


@celery_app.task(name="ai_file_ocr.tasks.run_pdf_ocr")
def run_pdf_ocr(doc_id: int, pdf_bytes: bytes, callback_url: str):

    total_start = time.time()

    # 1) PDF → 이미지 변환
    t0 = time.time()
    pages = pdf_to_images(pdf_bytes)
    print(f"[TIME] PDF to images: {time.time() - t0:.2f} sec")

    mem = ContextMemory(max_history=3)

    # 페이지 순회
    for page_number, img_bytes in pages:

        print(f"\n===== PAGE {page_number} START =====")

        # 2) S3 업로드
        t1 = time.time()
        s3_key = f"docs/{doc_id}/pages/{page_number}.png"
        image_url = upload_s3(img_bytes, s3_key, content_type="image/png")
        print(f"[TIME] S3 upload: {time.time() - t1:.2f} sec")

        # 3) 컨텍스트 로드
        t2 = time.time()
        context = mem.get_context()
        print(f"[TIME] Load context: {time.time() - t2:.2f} sec")

        # 4) Vision GPT 분석
        t3 = time.time()
        ocr_text = analyze_page_with_context(img_bytes, context)
        print(f"[TIME] Vision analysis: {time.time() - t3:.2f} sec")

        # 5) callback POST
        t4 = time.time()
        try:
            resp = requests.post(
                callback_url,
                json={
                    "doc_id": doc_id,
                    "page_number": page_number,
                    "image_url": image_url,
                    "ocr_text": ocr_text,
                },
                timeout=10,
            )
            resp.raise_for_status()
        except Exception as e:
            print(f"[AI OCR] callback 실패: doc={doc_id}, page={page_number}, error={e}")
        print(f"[TIME] Callback POST: {time.time() - t4:.2f} sec")

        # 6) mini-summary 생성
        t5 = time.time()
        mini = make_mini_summary(ocr_text)
        mem.add_summary(page_number, mini)
        print(f"[TIME] Mini summary: {time.time() - t5:.2f} sec")

        print(f"===== PAGE {page_number} END =====\n")

    print(f"[TOTAL TIME] run_pdf_ocr total: {time.time() - total_start:.2f} sec")
    return True
