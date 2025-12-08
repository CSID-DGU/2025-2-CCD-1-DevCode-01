import re
from google.cloud import texttospeech
from classes.utils import text_to_speech, time_to_seconds, math_pattern
from lecture_docs.models import *
from project.vertexai import gemini_model
from users.models import User
from django.conf import settings
from botocore.exceptions import NoCredentialsError
import boto3

latex_patterns = [
    r'\\\((.*?)\\\)',
    r'\\\[(.*?)\\\]',
    r'\$\$(.*?)\$\$',
    r'(\\begin\{.*?\}.*?\\end\{.*?\})',
]

text_commands = [
    "textbf", "textit", "textrm", "textsf",
    "texttt", "text", "mathrm", "mathbf"
]

text_pattern = r'\\(' + '|'.join(text_commands) + r')\{([^{}]+)\}'

code_pattern = r"```(.*?)```"

tts_client = texttospeech.TextToSpeechClient(transport="rest")

def summarize_stt(doc_id: int, user: User) -> tuple[str, str]:
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

    doc_end_time_sec = time_to_seconds(doc.end_time) if doc.end_time else 0.0

    # 2️⃣ 모든 페이지의 STT 텍스트 병합
    stt_texts = []
    for page in doc.pages.all():
        for speech in page.speeches.all():
            if speech.stt and speech.stt.strip():
                # 교안 종료 이후의 STT만 포함
                if speech.end_time_sec >= doc_end_time_sec:
                    stt_texts.append(speech.stt.strip())

    if not stt_texts:
        raise ValueError("요약할 STT 데이터가 없습니다.")

    combined_stt = "\n".join(stt_texts)

    # 3️⃣ Gemini 프롬프트 생성
    prompt = f"""
    너는 '{lecture_title}' 강의의 '{doc_title}' 교안에 대한 전문가이다.
    
    요약 규칙:
    - 오탈자나 일부 누락이 있을 수 있으니 의미를 올바르게 해석한다.
    - 원문에 없는 새로운 사실은 추가하지 않는다.
    - 중복된 설명은 생략한다.
    - 중요하고 핵심적인 개념 위주로 정리한다.
    - 1000자 이내로 요약한다.

    아래 내용을 요약해줘:
    {combined_stt}
    """

    summary_text = summarize(prompt).strip()

    # Google TTS 변환 + S3 업로드
    try:
        tts_url = text_to_speech(summary_text, user, s3_folder="tts/stt_summary/")
    except Exception as e:
        raise RuntimeError(f"TTS 변환 중 오류 발생: {e}")
    
    return summary_text, tts_url

def summarize_doc(doc_id: int, ocr_text: str) -> str:
    # 1️⃣ 교안 및 연관 데이터 불러오기
    doc = Doc.objects.select_related("lecture").get(id=doc_id)
    lecture_title = doc.lecture.title
    doc_title = doc.title

    if not ocr_text or not ocr_text.strip():
        raise ValueError("요약할 OCR 데이터가 없습니다.")

    ocr_text = ocr_text.strip()
   
    # 3️⃣ Gemini 프롬프트 생성
    prompt = f"""
    너는 '{lecture_title}' 강의의 '{doc_title}' 교안에 대한 전문가이다.

    요약 규칙:
    - 오탈자나 일부 누락이 있을 수 있으니 의미를 올바르게 해석한다.
    - 수식은 LaTeX 문법으로만 출력하라. (\(...\), \[...\], \begin{...}...\end{...} 그대로 유지)
    - 코드(쉘 명령어 포함)는 코드블록(```)으로 감싸서 출력하되 언어명은 작성하지 않는다.
    - 원문에 없는 새로운 사실은 추가하지 않는다.
    - 중복된 설명은 생략한다.
    - 중요하고 핵심적인 개념 위주로 정리한다.
    - 200자 이내로 요약한다.
    
    아래 내용을 요약해줘:
    {ocr_text}
    """

    response = summarize(prompt).strip()

    response = latex_rewrite(remove_text(response))
    response = code_rewrite(response)

    return response

# 수식 치환 함수
def safe_sub(pattern, repl, text):
    def wrapper(match):
        start = match.start()
        # 이미 <수식> 태그 안에 있는지 검사
        open_tag = text.rfind("<수식>", 0, start)
        close_tag = text.rfind("</수식>", 0, start)

        # <수식>은 보였지만 </수식>이 안 보였다 → 수식 내부
        if open_tag != -1 and (close_tag == -1 or close_tag < open_tag):
            return match.group(0)
        return repl(match)

    return re.sub(pattern, wrapper, text, flags=re.DOTALL)

#수식 밖 Latex 제거
def remove_text(text: str) -> str:
    math_spans = []
    for pattern in latex_patterns:
        for m in re.finditer(pattern, text, flags=re.DOTALL):
            math_spans.append((m.start(), m.end()))

    def is_inside_math(pos):
        for start, end in math_spans:
            if start <= pos < end:
                return True
        return False

    def replacer(match):
        cmd = match.group(1)
        inner = match.group(2)
        start = match.start()

        if is_inside_math(start):
            return match.group(0)
        return inner

    return re.sub(text_pattern, replacer, text)

#수식 후처리
def latex_rewrite(text: str) -> str:
    def latex_replace(match):
        inner = match.group(1).strip()
        return f"<수식>\n{inner}\n</수식>"

    for pattern in latex_patterns:
        text = safe_sub(pattern, latex_replace, text)

    text = remove_tag(text)

    return text

#중첩된 수식 제거
def remove_tag(text: str) -> str:
    while True:
        new_text = text
        new_text = re.sub(r'<수식>\s*<수식>', '<수식>', new_text)
        new_text = re.sub(r'</수식>\s*</수식>', '</수식>', new_text)
        new_text = math_pattern.sub(
            lambda m: f"<수식>\n{re.sub(r'</?수식>', '', m.group(1)).strip()}\n</수식>", 
            new_text
        )
        
        if new_text == text:
            break
        text = new_text
        
    return text

#코드 후처리
def code_rewrite(text: str) -> str:
    def code_replace(match):
        inner = match.group(1).strip()
        return f"<코드>\n{inner}\n</코드>"
    
    text = re.sub(code_pattern, code_replace, text, flags=re.DOTALL)

    return text

def summarize(prompt) -> str:
    """
    Gemini 호출 요약본 생성 함수
    프롬프트를 받아서 요약문 반환
    """

    # Gemini 모델 호출
    try:
        response = gemini_model.generate_content(prompt)

        if not response or not getattr(response, "text", "").strip():
            raise ValueError("Gemini 응답이 비어 있습니다.")
        
        summary_text = response.text.strip()

    except Exception as e:
        raise RuntimeError(f"Gemini 응답 생성 중 오류 발생: {e}")

    return summary_text

def upload_s3(file_obj, file_name, folder=None, content_type=None):
    try:
        s3 = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION,
        )

        key = f"{folder}/{file_name}" if folder else file_name

        extra_args = {"ContentType": content_type or "application/octet-stream"}
        s3.upload_fileobj(file_obj, settings.AWS_BUCKET_NAME, key, ExtraArgs=extra_args)

        url = f"{settings.AWS_S3_BASE_URL}/{key}"
        return url

    except NoCredentialsError:
        raise Exception("AWS 자격 증명이 없습니다. 환경변수를 확인하세요.")
    except Exception as e:
        raise Exception(f"S3 업로드 실패: {e}")

def exam_tts(text: str, user: User):
    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice_map = {
        "여성": "ko-KR-Neural2-A",
        "남성": "ko-KR-Neural2-C",
    }
    voice = voice_map.get(user.voice or "여성")

    voice_config = texttospeech.VoiceSelectionParams(
        language_code="ko-KR",
        name=voice,
    )

    rate_map = {"느림": 0.8, "보통": 1.0, "빠름": 1.25}
    speaking_rate = rate_map.get(user.rate or "보통")

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,
    )

    response = tts_client.synthesize_speech(
        input=synthesis_input, voice=voice_config, audio_config=audio_config
    )

    return response.audio_content 