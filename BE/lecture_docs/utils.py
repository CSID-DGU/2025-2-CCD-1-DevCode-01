import fitz
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextContainer
from django.core.files.base import ContentFile
from classes.utils import text_to_speech
from lecture_docs.models import Doc
from vertexai import generative_models
import vertexai

def special_char(text):
    replacements = {
        'à': '→', 'â': '⇒', 'á': '▶',
        'â€œ': '"', 'â€': '"', 'â€˜': "'", 'â€™': "'",
        'â€¦': '...', '·': '·', '•': '•',
        'Ã—': '×', 'Ã‚±': '±',
        '–': '-', '—': '—',
        'Â©': '©', 'Â®': '®', 'Â°': '°',
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text


def pdf_to_text(file):
    try:
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            for chunk in file.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name

        page_texts = []
        for page_layout in extract_pages(tmp_path):
            text = ""
            for element in page_layout:
                if isinstance(element, LTTextContainer):
                    text += element.get_text()

            cleaned = special_char(text.strip())      
            page_texts.append(cleaned)

        return page_texts

    except Exception as e:
        print(f"[ERROR] PDFMiner text extraction failed: {e}")
        return []


def pdf_to_embedded_images(page, pdf):

    images = []
    for idx, img in enumerate(page.get_images(full=True), start=1):
        xref = img[0]
        base_image = pdf.extract_image(xref)
        image_bytes = base_image["image"]
        image_ext = base_image["ext"]
        images.append({
            "bytes": image_bytes,
            "ext": image_ext,
            "name": f"embedded_{idx}.{image_ext}"
        })
    return images

def pdf_to_image(page, title, page_num):

    pix = page.get_pixmap(dpi=150)
    img_bytes = pix.tobytes("png")
    image_file = ContentFile(img_bytes, name=f"{title}_page{page_num}.png")
    return image_file

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
    아래는 강의에 대한 교수님 발화 내용들이야.
    이 내용을 모두 참고해서 1000자 이내로 간결하고 핵심적인 요약문을 작성해줘.
    ---
    {combined_stt}
    ---
    요약문:
    """

    return summarize(prompt)

def summarize(prompt: str) -> tuple[str, str]:
    """
    Gemini 호출 요약본 생성 함수
    프롬프트를 받아서 요약문과 TTS URL 반환
    """

    # Gemini 모델 호출
    model = generative_models.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(prompt)

    summary_text = response.text.strip()

    # Google TTS 변환 + S3 업로드
    tts_url = text_to_speech(summary_text, s3_folder="tts/stt_summary/")

    return summary_text, tts_url

