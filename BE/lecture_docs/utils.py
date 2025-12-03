import re
from google.cloud import texttospeech
from classes.utils import text_to_speech, time_to_seconds
from lecture_docs.models import *
from project.vertexai import gemini_model
from users.models import User
from django.conf import settings
from botocore.exceptions import NoCredentialsError
import boto3

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
    - 코드(쉘 명령어 포함)는 plain text로 작성하되 언어명을 추가하지 마라. 
    - 코드 위에 언어명(json, python 등)을 절대 추가하지 마라.
    - 원문에 없는 새로운 사실은 추가하지 않는다.
    - 중복된 설명은 생략한다.
    - 중요하고 핵심적인 개념 위주로 정리한다.
    - 200자 이내로 요약한다.
    
    아래 내용을 요약해줘:
    ---
    {ocr_text}
    ---
    """

    response = summarize(prompt).strip()

    response = latex_rewrite(response)
    response = code_rewrite(response)

    return response

#수식 후처리
def latex_rewrite(text: str) -> str:
    # \[ ... \]
    text = re.sub(
        r'\\\[(.*?)\\\]',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text,
        flags=re.DOTALL
    )

    # $$ ... $$
    text = re.sub(
        r'\$\$(.*?)\$\$',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text,
        flags=re.DOTALL
    )

    # \( ... \)
    text = re.sub(
        r'\\\((.*?)\\\)',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text
    )

    # \begin{env} ... \end{env}
    text = re.sub(
        r'(\\begin\{.*?\}.*?\\end\{.*?\})',
        lambda m: f"<수식>\n{m.group(1).strip()}\n</수식>",
        text,
        flags=re.DOTALL
    )

    return text

#코드 후처리
def code_rewrite(text: str) -> str:

    # ``` ... ``` 감지
    text = re.sub(
        r"```(.*?)```",
        lambda m: f"<코드>\n{m.group(1).strip()}\n</코드>",
        text,
        flags=re.DOTALL
    )

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
        raise RuntimeError(f"Gemini 요약 생성 중 오류 발생: {e}")

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
    client = texttospeech.TextToSpeechClient(transport="rest")

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

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice_config, audio_config=audio_config
    )

    return response.audio_content 