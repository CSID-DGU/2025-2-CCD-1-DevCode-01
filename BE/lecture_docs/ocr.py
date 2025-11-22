import json
import logging
import os
import base64
from io import BytesIO
from .utils import *
from openai import OpenAI
from dotenv import load_dotenv
from lecture_docs.models import *
from celery import shared_task
from .models import *

# pdf 이미지 변환
def pdf_to_image(page, title, page_num):
    pix = page.get_pixmap(dpi=150)
    img_bytes = pix.tobytes("png")
    image_bytesio = BytesIO(img_bytes)
    image_bytesio.seek(0)
    return image_bytesio

# 교안 ocr
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

PROMPT_TEMPLATE = """
너는 시각장애 대학생을 위한 강의 슬라이드 변환 도우미다.
입력은 PDF에서 추출한 한 페이지 이미지 1장이다.

아래 형식으로 한국어 텍스트만 출력해라. 불필요한 인사말·설명은 쓰지 마라.

[제목]
- 슬라이드의 핵심 제목이 있을 때만 1줄로 쓴다.

[본문]
- 슬라이드 핵심 내용을 2~4문단으로 자연스럽게 정리한다.
- 문장 그대로 베끼기보다 요약·정리 위주로 쓴다.
- 그림이나 표 안의 내용은 여기서 자세히 반복하지 않는다.

[이미지 설명]
- 학습 내용에 중요한 그림·도식·그래프가 있을 때만 쓴다.
- 배경 이미지, 로고, 디자인용 아이콘 등은 설명하지 않는다.
- 최대 3문장 안에서, 텍스트를 못 보는 학생도 이해할 수 있게 핵심만 설명한다.

[표]
- 표가 있을 때만 쓴다.
- 모든 셀을 나열하지 말고, 비교·범위·추세 등 핵심 정보만 3~5문장으로 요약한다.

규칙:
- 각 섹션 제목([제목], [본문] 등)은 그대로 사용한다.
- 내용이 없으면 그 섹션은 아예 생략한다.
- 줄임말이나 전문 용어가 많으면 간단히 풀어 쓴다.
"""


def page_ocr(page: Page, image_bytes: BytesIO):
    try:
        # GPT Vision 입력용 base64 인코딩
        image_b64 = base64.b64encode(image_bytes.getvalue()).decode("utf-8")

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": PROMPT_TEMPLATE},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "이 이미지를 분석해줘."},
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}}
                    ]
                },
            ],
            temperature=0.3,
        )

        result = response.choices[0].message.content.strip()
        page.ocr = result
        page.save(update_fields=["ocr"])
        return result

    except Exception as e:
        raise RuntimeError(f"OCR 변환 실패: {e}")

@shared_task
def run_page_ocr(page_id, raw_bytes, s3_key, user_id=None):
    try:
        page = Page.objects.get(id=page_id)
    except Page.DoesNotExist:
        return
    
    image_bytes = BytesIO(raw_bytes)

    try:
        ocr_result = page_ocr(page, image_bytes)
    except Exception as e:
        page.ocr = f"[OCR 오류] {e}"
        page.save(update_fields=["ocr"])
        return

    try:
        s3_url = upload_s3(BytesIO(raw_bytes), s3_key, content_type="image/png")
        page.image = s3_url
        page.save(update_fields=["image"])
    except Exception as e:
        page.image = None
        page.save(update_fields=["image"])
        return

    return "ok"