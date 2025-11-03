from google.cloud import speech
from google.cloud import texttospeech
import boto3
from django.conf import settings
import io
import uuid

def speech_to_text(audio_file) -> str:
    """
    업로드된 음성 파일을 Google Speech-to-Text로 변환
    짧은 음성(1초 미만) 또는 변환 결과가 없을 경우 예외 처리
    """

    client = speech.SpeechClient()

    # 1️⃣ 메모리에서 파일 내용 바로 읽기
    content = audio_file.read()

    if len(content) < 10000:  # 대략 1초 이하 (10KB 미만)
        raise ValueError("음성 파일이 너무 짧습니다. 1초 이상 길이의 파일을 업로드해주세요.")


    # 2️⃣ 확장자에 따라 인코딩 설정
    filename = audio_file.name.lower()
    if filename.endswith(".mp3"):
        encoding = speech.RecognitionConfig.AudioEncoding.MP3
        sample_rate = 16000
    elif filename.endswith(".wav"):
        encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
        sample_rate = 16000
    else:
        raise ValueError("지원하지 않는 오디오 형식입니다. (mp3 또는 wav만 가능)")

    # 3️⃣ Google STT 요청
    audio = speech.RecognitionAudio(content=content)

    config = speech.RecognitionConfig(
        encoding=encoding,
        sample_rate_hertz=sample_rate,
        language_code="ko-KR",
        model="default",
        use_enhanced=True,
        enable_automatic_punctuation=True,
    )

    response = client.recognize(config=config, audio=audio)

    # 4️⃣ 결과 텍스트 추출
    if not response.results:
        raise ValueError("음성 인식 결과가 없습니다. 음성이 너무 짧거나 인식되지 않았습니다.")
    
    transcript = response.results[0].alternatives[0].transcript.strip()

    if len(transcript) == 0:
        raise ValueError("인식된 텍스트가 비어 있습니다.")

    return transcript

def text_to_speech(text: str, s3_folder: str = "tts/") -> str:
    
    if not text or text.strip() == "":
        raise ValueError("TTS 변환할 텍스트가 비어 있습니다.")

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

    if not response.audio_content:
        raise ValueError("TTS 변환에 실패했습니다. 응답이 비어 있습니다.")

    # 3️⃣ S3 업로드 (메모리 버퍼 사용)
    s3 = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name='ap-northeast-2'
    )

    bucket_name = settings.AWS_BUCKET_NAME
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