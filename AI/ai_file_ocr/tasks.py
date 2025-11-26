# tasks.py (완전 수정본 ― llama_index SummaryIndex 기반 문맥 메모리 적용)

import base64
from io import BytesIO
import os
import requests
import boto3
from dotenv import load_dotenv

from ai_file_ocr.celery_app import celery_app
from ai_file_ocr.pipeline.ocr import pdf_to_images, analyze_page_with_context
from ai_file_ocr.pipeline.summarize import make_mini_summary
from ai_file_ocr.pipeline.memory import ContextMemory   # ⬅ 핵심

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

    # 2) PDF → 이미지 변환
    pages = pdf_to_images(pdf_bytes)

    # 3) llama_index 기반 문맥 메모리 객체 생성
    mem = ContextMemory()

    # 4) 페이지 분석
    for page_number, img_bytes in pages:

        s3_key = f"docs/{doc_id}/pages/{page_number}.png"
        image_url = upload_s3(img_bytes, s3_key, content_type="image/png")

        # llama_index 기반 문맥 가져오기 (최근 k개)
        current_context = mem.get_context(k=5)

        # OCR + 문맥 기반 Vision 분석
        ocr_text = analyze_page_with_context(img_bytes, current_context)

        # llama_index로 사용할 요약 (mini-summary 활용)
        mini = make_mini_summary(ocr_text)

        # llama_index 메모리에 요약 저장
        mem.add_summary(page_number, mini)

        # 5) callback 전달
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

    return True
