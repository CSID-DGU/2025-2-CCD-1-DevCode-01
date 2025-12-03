import os
import boto3
import shutil
import traceback
from ai_exam_ocr.pipeline.pipeline import process_exam
from dotenv import load_dotenv
import boto3
import cv2
from io import BytesIO
import os

S3_BUCKET = os.getenv("AWS_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION")

s3_client = boto3.client("s3", region_name=AWS_REGION)


def upload_s3(local_path: str, key_prefix: str):
    filename = os.path.basename(local_path)
    key = f"exam/{key_prefix}/{filename}"

    s3_client.upload_file(
        local_path,
        S3_BUCKET,
        key,
    )

    return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"

def run_exam_ocr(image_np, user_id: str, now_str: str):
    try:
        exam_json = process_exam(
            image_np=image_np,
            user_id=user_id,
            now_str=now_str
        )
        return {"status": "done", "data": exam_json}

    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

