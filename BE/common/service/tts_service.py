from google.cloud import texttospeech
import boto3
from django.conf import settings
import io
import uuid

"""
공통 TTS 변환 함수
텍스트를 Google Text-to-Speech로 변환하고
S3에 mp3 파일을 업로드 후 URL을 반환합니다.
"""

def text_to_speech(text: str, s3_folder: str = "tts/") -> str:
    
    # 1️⃣ Google TTS 클라이언트 생성
    client = texttospeech.TextToSpeechClient()

    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(
        language_code="ko-KR",
        name="ko-KR-Neural2-B"
    )
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)

    # 2️⃣ TTS 변환
    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config
    )

    # 3️⃣ S3 업로드 (메모리 버퍼 사용)
    s3 = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name='ap-northeast-2'
    )

    bucket_name = settings.AWS_STORAGE_BUCKET_NAME
    filename = f"{uuid.uuid4()}.mp3"
    s3_key = f"{s3_folder}{filename}"

    # BytesIO로 메모리 내에서 직접 업로드
    s3.upload_fileobj(
        io.BytesIO(response.audio_content),
        bucket_name,
        s3_key,
        ExtraArgs={'ContentType': 'audio/mpeg'}
    )

    s3_url = f"{settings.AWS_S3_BASE_URL}/{s3_key}"

    return s3_url