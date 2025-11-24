import os
import base64
from io import BytesIO

import fitz

from .lecture_ocr.pipeline import run_lecture_ocr
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

# # 교안 ocr
# load_dotenv()
# client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# PROMPT_TEMPLATE = """
# 너는 시각장애 대학생을 위한 강의 슬라이드 변환 도우미다.
# 입력은 PDF에서 추출한 한 페이지 이미지 1장이다.

# 아래 형식으로 출력해라. 불필요한 인사말·설명은 쓰지 마라.

# [제목]
# - 슬라이드의 핵심 제목이 있을 때만 1줄로 쓴다.

# [본문]
# - 문단구조를 유지하여 본문의 텍스트 추출 한다. 
# - 텍스트를 추출하면서 사전적으로 정의되지 않은 단어는 해당 본문 내용에 맞춰 보정한다. 
# - 그림이나 표 안의 내용은 여기서 자세히 반복하지 않는다.

# [이미지 설명]
# - 학습 내용에 중요한 그림·도식·그래프가 있을 때만 쓴다.
# - 여러 이미지가 있을 경우 하나씩 다 설명한다. 
# - 배경 이미지, 로고, 디자인용 아이콘 등은 설명하지 않는다.
# - 다음과 같은 순서로 이미지를 설명한다. 
# - 1. 이미지의 외관을 묘사한다.
# - 2. 이미지를 보지 않고도 이해할 수 있도록 본문과 연관지어 핵심을 정리한다.

# [표/그래프]
# - 표/그래프가 있을 때만 쓴다.
# - 다음과 같은 순서로 표를 설명한다.
# - 1. 어떤 형태의 표/그래프 인지 설명한다.
# - 2. 모든 셀을 나열하지 말고, 비교·범위·추세 등 핵심 정보만 3~5문장으로 요약한다.

# 규칙:
# - 각 섹션 제목([제목], [본문] 등)은 그대로 사용한다.
# - 한국어와 다른 언어가 섞여 있을 시 번역하지 않고 해당 언어로 작성한다. 대신 한자는 한글로 변환한다.
# - 내용이 없으면 그 섹션은 아예 생략한다.
# - 줄임말이나 전문 용어가 많으면 간단히 풀어 쓴다.
# """


# def page_ocr(page: Page, image_bytes: BytesIO):
#     try:
#         # GPT Vision 입력용 base64 인코딩
#         image_b64 = base64.b64encode(image_bytes.getvalue()).decode("utf-8")

#         response = client.chat.completions.create(
#             model="gpt-4o",
#             messages=[
#                 {"role": "system", "content": PROMPT_TEMPLATE},
#                 {
#                     "role": "user",
#                     "content": [
#                         {"type": "text", "text": "이 이미지를 분석해줘."},
#                         {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}}
#                     ]
#                 },
#             ],
#             temperature=0.3,
#         )

#         result = response.choices[0].message.content.strip()
#         page.ocr = result
#         page.save(update_fields=["ocr"])
#         return result

#     except Exception as e:
#         raise RuntimeError(f"OCR 변환 실패: {e}")

@shared_task
def run_pdf_processing(doc_id, pdf_bytes):

    doc = Doc.objects.get(id=doc_id)
    pdf = fitz.open(stream=pdf_bytes, filetype="pdf")

    pages = []   # (page_number, image_raw_bytes)
    page_objs = []

    # 1) 페이지 이미지 생성 + S3 저장
    for page_num, page in enumerate(pdf, start=1):

        page_obj = Page.objects.create(doc=doc, page_number=page_num)
        page_objs.append(page_obj)

        # 이미지 변환
        img_bytes = page.get_pixmap(dpi=150).tobytes("png")
        pages.append((page_num, img_bytes))

        # S3 저장
        s3_key = f"docs/{doc.id}/pages/{page_num}.png"
        s3_url = upload_s3(BytesIO(img_bytes), s3_key, content_type="image/png")

        page_obj.image = s3_url
        page_obj.save(update_fields=["image"])

    pdf.close()

    # 2) Memory 기반 OCR 파이프라인 실행
    rewritten_pages, final_summary = run_lecture_ocr(pages)

    # 3) 페이지별 재해석된 OCR를 DB에 저장
    for (page_num, text) in rewritten_pages:
        page_obj = page_objs[page_num - 1]
        page_obj.ocr = text
        page_obj.save(update_fields=["ocr"])