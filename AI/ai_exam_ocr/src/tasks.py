import os
import uuid
import shutil
import tempfile
import traceback

from ai_file_ocr.celery_app import celery_app
import boto3

from ai_exam_ocr.src.exam_ocr.pipeline import process_exam


S3_BUCKET = os.getenv("AWS_BUCKET_NAME")
AWS_REGION = os.getenv("AWS_REGION")

s3_client = boto3.client("s3", region_name=AWS_REGION)


def upload_s3(local_path: str, key_prefix: str) -> str:
    filename = os.path.basename(local_path)
    key = f"exam/{key_prefix}/{filename}"

    s3_client.upload_file(
        local_path,
        S3_BUCKET,
        key,
        ExtraArgs={"ContentType": "image/png"}
    )
    return f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"


@celery_app.task(name="ai_exam_ocr.src.tasks.run_exam_ocr")
def run_exam_ocr(image_bytes: bytes, ext: str):

    tmp_root = tempfile.mkdtemp(prefix="exam_")
    uid = uuid.uuid4().hex

    img_path = os.path.join(tmp_root, f"input_{uid}{ext}")
    out_dir = os.path.join(tmp_root, "out")

    try:
        with open(img_path, "wb") as f:
            f.write(image_bytes)

        exam_json = process_exam(
            image_path=img_path,
            output_dir=out_dir,
            base_url=None,
            save_json=False
        )

        for q in exam_json.get("questions", []):
            q_img = q.get("questionImagePath")
            if q_img:
                q["questionImagePath"] = upload_s3(
                    q_img, f"questions/{uid}"
                )

            for item in q.get("items", []):
                item_img = item.get("imagePath")
                if item_img:
                    item["imagePath"] = upload_s3(
                        item_img, f"items/{uid}"
                    )

        return {"status": "done", "data": exam_json}

    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)
