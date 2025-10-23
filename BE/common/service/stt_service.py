from google.cloud import speech

def speech_to_text(audio_file) -> str:
    """
    업로드된 음성 파일을 Google Speech-to-Text로 변환
    """

    client = speech.SpeechClient()

    # 1️⃣ 메모리에서 파일 내용 바로 읽기
    content = audio_file.read()

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
        language_code="ko-KR"
    )

    response = client.recognize(config=config, audio=audio)

    # 4️⃣ 결과 텍스트 추출
    if not response.results:
        return ""

    transcript = response.results[0].alternatives[0].transcript
    return transcript
