import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()
BROKER_URL = os.getenv("CELERY_BROKER_URL")
BACKEND_URL = os.getenv("CELERY_RESULT_BACKEND")


celery_app = Celery(
    "ai_ocr",
    broker=BROKER_URL,
    backend=BACKEND_URL,
)


celery_app.autodiscover_tasks(['ai_file_ocr', 'ai_exam_ocr'], force=True)

celery_app.conf.update(
    task_routes={
        "ai_file_ocr.tasks.run_pdf_ocr": {"queue": "ai"},
        "ai_exam_ocr.tasks.run_exam_ocr": {"queue": "exam"},
    }
)