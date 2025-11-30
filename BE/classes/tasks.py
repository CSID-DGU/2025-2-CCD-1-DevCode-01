# classes/tasks.py
from io import BytesIO
from celery import shared_task
from classes.utils import *
from classes.models import Speech, Bookmark
from lecture_docs.models import Page
from django.contrib.auth import get_user_model
from pydub import AudioSegment

User = get_user_model()

def save_temp_audio(audio_file):
    original_name = getattr(audio_file, "name", "")
    ext = os.path.splitext(original_name)[1].lower()  

    filename = f"{uuid.uuid4()}{ext}"
    temp_path = os.path.join(settings.MEDIA_ROOT, "temp", filename)

    os.makedirs(os.path.dirname(temp_path), exist_ok=True)

    with open(temp_path, "wb") as f:
        for chunk in audio_file.chunks():
            f.write(chunk)

    return temp_path

def convert_to_wav(input_path: str) -> str:
    ext = os.path.splitext(input_path)[1].lower()
    fmt = ext.lstrip(".") or "webm"

    wav_filename = f"{uuid.uuid4()}.wav"
    temp_dir = os.path.join(settings.MEDIA_ROOT, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    wav_path = os.path.join(temp_dir, wav_filename)

    try:
        with open(input_path, "rb") as f:
            data = f.read()
    except Exception as e:
        raise RuntimeError(f"convert_to_wav: 파일 읽기 실패 ({input_path}) | {e}")

    try:
        audio = AudioSegment.from_file(BytesIO(data), format=fmt)
    except Exception as e:
        raise RuntimeError(
            f"[convert_to_wav] AudioSegment 변환 실패: ffmpeg가 webm/m4a/opus 코덱을 지원하지 않거나 "
            f"파일이 손상됨. | input={input_path} | format={fmt} | error={e}"
        )

    try:
        audio.export(
            wav_path,
            format="wav",
            parameters=["-acodec", "pcm_s16le", "-ac", "1", "-ar", "16000"]
        )
    except Exception as e:
        raise RuntimeError(f"[convert_to_wav] WAV 변환 실패 | output={wav_path} | {e}")

    if not os.path.exists(wav_path):
        raise RuntimeError(f"convert_to_wav: WAV 파일 생성 실패 ({wav_path})")

    return wav_path

@shared_task
def run_speech(speech_id, audio_path, page_id, user_id):
    speech = Speech.objects.get(id=speech_id)
    page = Page.objects.get(id=page_id)
    user = User.objects.get(id=user_id)

    wav_path = None

    try:
        if not audio_path:
            raise ValueError(f"run_speech: audio_path가 None 입니다. (speech_id={speech_id})")

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"run_speech: audio 파일이 존재하지 않습니다. ({audio_path})")

        wav_path = convert_to_wav(audio_path)
        if not wav_path:
            raise RuntimeError(f"run_speech: convert_to_wav() 결과 None (audio_path={audio_path})")


        stt_text, stt_words = speech_to_text(wav_path)

        s3_url = text_to_speech(stt_text, user, "tts/speech/")

        duration_sec, duration = get_duration(wav_path)
        end_time_sec = speech.end_time_sec
        start_time_sec = end_time_sec - duration_sec

        bookmarks = Bookmark.objects.filter(page=page)
        for b in bookmarks:
            if start_time_sec <= b.timestamp_sec <= end_time_sec:
                b.relative_time = round(b.timestamp_sec - start_time_sec)
                b.text = extract_text(stt_words, b.relative_time, user)
                b.save(update_fields=["relative_time", "text"])

        speech.stt = stt_text
        speech.stt_tts = s3_url
        speech.duration = duration
        speech.duration_sec = duration_sec
        speech.save()

    except Exception as e:
        print(f"[run_speech] ERROR | speech_id={speech_id} audio_path={audio_path} wav_path={wav_path} | {e}")
        raise

    finally:
        for path in {audio_path, wav_path}:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception:
                    pass