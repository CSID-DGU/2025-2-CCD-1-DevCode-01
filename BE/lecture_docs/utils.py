import base64
import os
import fitz
from openai import OpenAI
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer
from django.core.files.base import ContentFile
from classes.utils import text_to_speech
from lecture_docs.models import Doc, Page
from dotenv import load_dotenv

def pdf_to_image(page, title, page_num):

    pix = page.get_pixmap(dpi=150)
    img_bytes = pix.tobytes("png")
    image_file = ContentFile(img_bytes, name=f"{title}_page{page_num}.png")
    return image_file

load_dotenv() 
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

PROMPT_TEMPLATE = """
너는 시각장애인이 접근 가능한 학습자료를 제작하는 보조자야. 
다음은 강의자료를 이미지파일로 만들어낸 거야. 
이 사진은 PDF의 각 페이지에서 추출된 거야. 

각 페이지를 다음 구조로 가공해줘:
1. 📌 제목(있다면)
2. 📄 본문 텍스트: 문단 구분을 유지하며 자연스럽게 정리, 사진 외의 내용은 설명하지마
3. 🖼️ 이미지/도식 설명(있다면): 보이지 않아도 이해할 수 있도록 이미지 내용을 말로 설명, 본문과 연관지어서 설명, 수업 내용과 관련없는 배경이미지, 로고같은건 설명생략
4. 📊 표가 있다면: 표 내용을 구조적으로 텍스트로 재구성, 본문과 연관지어서 설명
"""

def image_to_base64(image_path):
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def page_ocr(page: Page):
    image_b64 = image_to_base64(page.image.path)

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

def summarize_stt(doc_id: int) -> tuple[str, str]:
    """
    1. Doc ID로 모든 Page.speeches의 STT 텍스트 병합
    2. 강의명, 교안명을 포함한 프롬프트 구성
    3. Gemini 모델을 이용해 1000자 이내 요약 생성
    4. Google TTS 변환 + S3 업로드
    5. 요약문과 TTS URL 반환
    """
    
    # 1️⃣ 교안 및 연관 데이터 불러오기
    doc = Doc.objects.select_related("lecture").prefetch_related("pages__speeches").get(id=doc_id)
    lecture_title = doc.lecture.title if doc.lecture else "강의"
    doc_title = doc.title

    # 2️⃣ 모든 페이지의 STT 텍스트 병합
    stt_texts = [
        speech.stt.strip()
        for page in doc.pages.all()
        for speech in page.speeches.all()
        if speech.stt and speech.stt.strip()
    ]
    if not stt_texts:
        raise ValueError("요약할 STT 데이터가 없습니다.")

    combined_stt = "\n".join(stt_texts)

    # 3️⃣ Gemini 프롬프트 생성
    prompt = f"""
    너는 '{lecture_title}' 강의의 '{doc_title}' 교안에 대한 전문가야.
    아래는 강의 중 교수님이 실제로 말한 내용이야.
    이 내용을 전체적으로 읽고, 1000자 이내로 요약해줘.

    단, 오탈자나 일부 누락이 있을 수 있으니 의미를 올바르게 해석하고,
    원문에 없는 새로운 사실은 추가하지 말고,
    중복된 설명은 생략하고,
    중요하고 핵심적인 개념 위주로 정리해.
    ---
    {combined_stt}
    ---
    요약문:
    """

    summary_text = summarize(prompt)

    # Google TTS 변환 + S3 업로드
    try:
        tts_url = text_to_speech(summary_text, s3_folder="tts/stt_summary/")
    except Exception as e:
        raise RuntimeError(f"TTS 변환 중 오류 발생: {e}")
    
    return summary_text, tts_url

# def summarize_doc(doc_id: int) -> tuple[str, str]:
#     # 1️⃣ 교안 및 연관 데이터 불러오기
#     doc = Doc.objects.select_related("lecture").prefetch_related("pages__speeches").get(id=doc_id)
#     lecture_title = doc.lecture.title if doc.lecture else "강의"
#     doc_title = doc.title

#     # 2️⃣ 모든 페이지의 ocr 텍스트 병합
#     ocr_texts = [
#         page.ocr.strip()
#         for page in doc.pages.all()
#         if page.ocr and page.ocr.strip()
#     ]

#     if not ocr_texts:
#         raise ValueError("요약할 OCR 데이터가 없습니다.")

#     combined_ocr = "\n".join(ocr_texts)

#     # 3️⃣ Gemini 프롬프트 생성
#     prompt = f"""
#     너는 '{lecture_title}' 강의의 '{doc_title}' 교안에 대한 전문가야.
#     아래는 강의 교안의 OCR 인식 결과야.
#     이 내용을 전체적으로 읽고, 200자 이내로 요약해줘.

#     단, 오탈자나 일부 누락이 있을 수 있으니 의미를 올바르게 해석하고,
#     원문에 없는 새로운 사실은 추가하지 말고,
#     중복된 설명은 생략하고,
#     중요하고 핵심적인 개념 위주로 정리해.
#     ---
#     {combined_ocr}
#     ---
#     요약문:
#     """

#     return summarize(prompt)

# def summarize(prompt: str) -> str:
#     """
#     Gemini 호출 요약본 생성 함수
#     프롬프트를 받아서 요약문 반환
#     """

#     # Gemini 모델 호출
#     try:
#         model = generative_models.GenerativeModel("gemini-2.5-flash")
#         response = model.generate_content(prompt)

#         if not response or not getattr(response, "text", "").strip():
#             raise ValueError("Gemini 응답이 비어 있습니다.")
        
#         summary_text = response.text.strip()

#     except Exception as e:
#         raise RuntimeError(f"Gemini 요약 생성 중 오류 발생: {e}")

#     return summary_text

