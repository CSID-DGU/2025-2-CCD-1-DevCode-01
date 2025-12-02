import re
import tempfile
import wave
from bs4 import BeautifulSoup
from google.cloud import speech, storage
from google.cloud import texttospeech, translate_v2 as translate
import boto3
from django.conf import settings
import io, os
import uuid
from datetime import datetime, timedelta
from groq import Groq
import markdown
import numpy as np

from users.models import User

symbol_map = {
    "!": "느낌표",
    "@": "앳",
    "#": "샵",
    "$": "달러",
    "%": "퍼센트",
    "^": "캐럿",
    "&": "앤드",
    "*": "애스터리스크",
    "(": "괄호 열고",
    ")": "괄호 닫고",
    "-": "하이픈",
    "_": "언더스코어",
    "=": "이퀄",
    "+": "플러스",
    "[": "대괄호 열고",
    "]": "대괄호 닫고",
    "{": "중괄호 열고",
    "}": "중괄호 닫고",
    "\\": "백슬래시",
    "|": "파이프",
    ";": "세미콜론",
    ":": "콜론",
    "'": "작은따옴표",
    '"': "큰따옴표",
    ",": "콤마",
    ".": "점",
    "/": "슬래시",
    "?": "물음표",
    "<": "꺾쇠 열고",
    ">": "꺾쇠 닫고",
    "~": "틸다",
    "`": "백틱",
    "\t": "들여쓰기",
}

symbol_pattern = re.compile("|".join(re.escape(k) for k in symbol_map.keys()))
code_pattern = re.compile(r"<코드>(.*?)</코드>", re.DOTALL)
math_pattern = re.compile(r"<수식>(.*?)</수식>", re.DOTALL)

client = Groq(api_key=settings.GROQ_API_KEY)

def upload_to_gcs(file_bytes: bytes, filename: str, bucket_name: str) -> str:
    """GCS 버킷에 파일 업로드 후 URI 반환"""
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(f"stt/{filename}")
    blob.upload_from_string(file_bytes)
    return f"gs://{bucket_name}/stt/{filename}"

def split_audio_on_silence(wav_bytes: bytes, silence_threshold=150, min_silence_len=2000):
    """
    WAV 파일을 무음 기준으로 분리하는 함수
    - silence_threshold: 무음 판단 기준 (샘플 진폭)
    - min_silence_len: 무음 길이 기준 (ms)
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(wav_bytes)
        tmp.flush()
        wav_path = tmp.name

    with wave.open(wav_path, "rb") as wf:
        rate = wf.getframerate()
        channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        n_frames = wf.getnframes()
        frames = wf.readframes(n_frames)

    # 16-bit PCM만 지원(일반적). 그 외는 안전하게 전체를 하나로 반환.
    if sampwidth != 2:
        return [wav_path], rate  # 분할 불가 → 통짜로 처리

    audio = np.frombuffer(frames, dtype=np.int16)
    if channels > 1:
        audio = audio.reshape(-1, channels)
        # 스테레오면 두 채널의 평균 절대값으로 무음 판단
        mono = audio.mean(axis=1).astype(np.int16)
    else:
        mono = audio

    abs_audio = np.abs(mono).astype(np.int32)
    silence_len = int((min_silence_len / 1000.0) * rate)

    silent_ranges = []
    start = None
    for i, v in enumerate(abs_audio):
        if v < silence_threshold:
            if start is None:
                start = i
        else:
            if start is not None and (i - start) >= silence_len:
                silent_ranges.append((start, i))
            start = None
    # 분할 포인트 구성
    split_points = [0] + [end for (_, end) in silent_ranges] + [len(mono)]

    chunks = []
    for i in range(len(split_points) - 1):
        s, e = split_points[i], split_points[i+1]
        if e - s < int(0.5 * rate):  # 0.5초 미만 chunk는 스킵
            continue
        # 원본 채널수 유지해서 파일로 다시 씀
        chunk_frames = audio[s*channels:e*channels] if channels > 1 else audio[s:e]
        out = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        with wave.open(out.name, "wb") as ow:
            ow.setnchannels(channels)
            ow.setsampwidth(sampwidth)
            ow.setframerate(rate)
            ow.writeframes(chunk_frames.tobytes())
        chunks.append(out.name)

    # 분할이 전혀 안 되었으면 원본 wav 그대로 사용
    if not chunks:
        chunks = [wav_path]
    else:
        # 원본 temp는 분할이 됐으면 제거
        os.remove(wav_path)

    return chunks, rate

def speech_to_text(audio_path) -> tuple[str, list]:
    client = speech.SpeechClient(transport="rest")

    with open(audio_path, "rb") as f:
        content = f.read()

    if len(content) < 10000:  
        raise ValueError("음성 파일이 너무 짧습니다. 1초 이상 길이의 파일을 업로드해주세요.")

    filename = audio_path.lower()
    if filename.endswith(".wav"):
        format_type = "wav"
        encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
    else:
        raise ValueError("지원하지 않는 오디오 형식입니다. (wav만 가능)")

    chunks, rate = split_audio_on_silence(content)

    config = speech.RecognitionConfig(
        encoding=encoding,
        language_code="ko-KR",
        sample_rate_hertz=rate,
        enable_separate_recognition_per_channel=False,
        model="latest_long",
        use_enhanced=True,
        enable_automatic_punctuation=True,
        enable_word_time_offsets=True
    )

    transcript = ""
    stt_words = []
    offset = 0.0

    for chunk in chunks:
        with open(chunk, "rb") as f:
            chunk_bytes = f.read()

        if len(chunk_bytes) < 1024 * 1024:
            audio = speech.RecognitionAudio(content=chunk_bytes)
            response = client.recognize(config=config, audio=audio)
        else:
            gcs_uri = upload_to_gcs(
                chunk_bytes,
                f"{uuid.uuid4()}.{format_type}",
                settings.GCP_BUCKET_NAME
            )
            audio = speech.RecognitionAudio(uri=gcs_uri)
            operation = client.long_running_recognize(config=config, audio=audio)
            response = operation.result(timeout=900)

        if response.results:
            for result in response.results:
                alt = result.alternatives[0]
                transcript += alt.transcript.strip() + " "
                for w in alt.words:
                    stt_words.append({
                        "word": w.word,
                        "start": w.start_time.total_seconds() + offset,
                        "end": w.end_time.total_seconds() + offset,
                    })

        os.remove(chunk)

    transcript = transcript.strip()
    if not transcript:
        raise ValueError("인식된 텍스트가 비어 있습니다.")

    return transcript, stt_words


def extract_text(stt_words, relative_time, user: User):
    for w in stt_words:
        if w["start"] <= relative_time <= w["end"]:
            return find_full_text(stt_words, w, user)
    return None

def find_full_text(stt_words, target_word, user: User):
    idx = stt_words.index(target_word)

    # 오른쪽으로 wps초 구간만 추출
    sentence_words = [target_word["word"]]
    start_time = target_word["start"]

    if user.rate == "느림":
        wps = 4.0
    elif user.rate == "빠름":
        wps = 8.0
    else:
        wps = 6.0  # 기본값
    
    for w in stt_words[idx+1:]:
        if w["end"] - start_time > wps: # 시작 단어 기준으로 wps초
            break
        sentence_words.append(w["word"])
    
    # 단어 결합 (▁ 제거하고 공백 처리)
    return "".join([w.replace("▁", " ") for w in sentence_words]).strip()

# 코드 전처리
def preprocess_code(code_text: str) -> str:
    lines = code_text.split("\n")
    processed_lines = []

    for line in lines:
        # 1) 앞쪽 공백 개수 → 들여쓰기
        leading_spaces = len(line) - len(line.lstrip(' '))
        total_indent = (leading_spaces // 4)
        indent_text = " ".join(["들여쓰기"] * total_indent) + " " if total_indent > 0 else ""

        # 2) 내용 부분
        content = line.lstrip(' ')

        # 3) 특수문자 전처리
        def replace_symbol(match):
            return f" {symbol_map[match.group(0)]} "

        content = symbol_pattern.sub(replace_symbol, content)

        # 4) 결과 합치기
        processed_lines.append(indent_text + content.strip())

    # 5) 줄바꿈 처리
    return " 줄바꿈 ".join(processed_lines)

def preprocess_text(processed_math):
    
    def replace_code(match):
        code_text = match.group(1)
        # 코드 전처리
        processed_code = preprocess_code(code_text)
        return processed_code
    
    def translate_math(match):
        english_math = match.group(1)
        # 수식 번역
        korean_math = translate(english_math)
        return korean_math

    # 최종 전처리 텍스트
    processed_text = code_pattern.sub(replace_code, processed_math)
    processed_text = math_pattern.sub(translate_math, processed_text)

    return processed_text

def translate(text: str) -> str:
    prompt = f"""
    너는 영어 수식을 한국어로 번역하는 전문가이다.
    아래는 영어로 표현된 수식이다:
    ---
    {text}
    ---
    
    이 수식을 한국어로 자연스럽게 번역한다.
    번역 규칙은 다음과 같다:

    1) 수식의 기호, 구조, 관계를 한국어로 정확히 표현한다.
    2) 수식을 설명하거나 해석하지 않고, 제공된 수식 자체만 번역한다.
    3) '~입니다', '~합니다', '~됩니다' 등 문어체 종결을 사용하지 않는다.
    4) 출력은 번역된 한국어 텍스트만 제공한다.

    번역문:
    """

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    
    result = response.choices[0].message.content.strip()
    
    return result

def markdown_to_text(md_text: str) -> str:
    if not md_text or md_text.strip() == "":
        raise ValueError("변환할 마크다운 텍스트가 비어 있습니다.")
    
    html = markdown.markdown(md_text)

    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(separator="\n")

    text = re.sub(r'\n\s*\n', '\n', text).strip()

    return text


def text_to_speech(text: str, user: User, s3_folder: str = "tts/") -> str:
    
    if not text or text.strip() == "":
        raise ValueError("TTS 변환할 텍스트가 비어 있습니다.")

    client = texttospeech.TextToSpeechClient(transport="rest")

    synthesis_input = texttospeech.SynthesisInput(text=text)
    
    voice_map = {
        "female": "ko-KR-Neural2-A",
        "male": "ko-KR-Neural2-C",
    }

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=1.0,
    )

    s3_urls = {}

    for gender, name in voice_map.items():
        voice_config = texttospeech.VoiceSelectionParams(
            language_code="ko-KR",
            name=name,
        )

        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice_config,
            audio_config=audio_config
        )

        if not response.audio_content:
            raise ValueError("TTS 변환에 실패했습니다. 응답이 비어 있습니다.")
    
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
        s3_urls[gender] = s3_url

    return s3_urls

def text_to_speech_local(text: str, voice: str, rate: str) -> str:
    """
    Google TTS 변환 후 로컬에만 MP3 저장 (S3 업로드 없음)
    """
    if not text or text.strip() == "":
        raise ValueError("TTS 변환할 텍스트가 비어 있습니다.")

    # 1️⃣ Google TTS 클라이언트 생성
    client = texttospeech.TextToSpeechClient(transport="rest")

    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice_map = {
        "여성": "ko-KR-Neural2-A",
        "남성": "ko-KR-Neural2-C",
    }
    name = voice_map.get(voice)
    
    voice_config = texttospeech.VoiceSelectionParams(
        language_code="ko-KR",
        name=name,
    )

    rate_map = {"느림": 0.8, "보통": 1.0, "빠름": 1.25}
    speaking_rate = rate_map.get(rate)

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=speaking_rate,
    )

    # 2️⃣ TTS 변환
    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice_config,
        audio_config=audio_config
    )

    if not response.audio_content:
        raise ValueError("TTS 변환에 실패했습니다. 응답이 비어 있습니다.")

    # 3️⃣ 로컬에만 저장
    local_dir = os.path.join(settings.BASE_DIR, "tts_local")
    os.makedirs(local_dir, exist_ok=True)

    base_name = text.strip().replace(" ", "")[:6] or "tts"
    gender_label = "(여성)" if "Neural2-A" in voice_config.name else "(남성)"
    safe_name = f"{base_name}{gender_label}.mp3"

    # 🚫 파일명에 파일 시스템 불가 문자 제거
    safe_name = "".join(c for c in safe_name if c.isalnum() or c in "()._")

    local_path = os.path.join(local_dir, safe_name)

    with open(local_path, "wb") as out:
        out.write(response.audio_content)

    return local_path

def time_to_seconds(hhmmss: str) -> float:
    try:
        t = datetime.strptime(hhmmss, "%H:%M:%S")
        return t.hour * 3600 + t.minute * 60 + t.second
    except ValueError:
        raise ValueError("시간 형식이 잘못되었습니다. (예: 00:12:45)")
    
def get_duration(audio):
    
    if isinstance(audio, str):
        file_path = audio

        if not os.path.exists(file_path):
            raise ValueError(f"파일 경로가 존재하지 않습니다: {file_path}")
    else:
        audio.seek(0)
        content = audio.read()
        file_path = "/tmp/_duration_temp.wav"
        with open(file_path, "wb") as f:
            f.write(content)

    filename = file_path.lower()

    if filename.endswith(".wav"):
        try:
            with wave.open(file_path, "rb") as wav_file:
                frames = wav_file.getnframes()
                rate = wav_file.getframerate()
                duration_sec = int(frames / rate)
                duration = str(timedelta(seconds=duration_sec))
                return duration_sec, duration

        except Exception as e:
            raise ValueError(f"WAV 길이 계산 실패: {e}")

    else:
        raise ValueError("지원하지 않는 오디오 포맷입니다. (WAV만 가능)")

    # ✅ MP3 파일
    # try:
    #     audio.seek(0)
    #     audio_obj = File(audio)
    #     if audio_obj and hasattr(audio_obj, "info") and hasattr(audio_obj.info, "length"):
    #         rate = int(getattr(audio_obj.info, "sample_rate", 16000))
    #         channels = getattr(audio_obj.info, "channels", 1)
    #         duration_sec = round(audio_obj.info.length, 2)
    #         duration = str(timedelta(seconds=int(duration_sec)))
    #         return duration_sec, duration, rate, channels
    #     else:
    #         raise ValueError("오디오 파일의 길이를 계산할 수 없습니다.")
    # except Exception as e:
    #     raise ValueError(f"오디오 길이 계산 실패: {e}")

