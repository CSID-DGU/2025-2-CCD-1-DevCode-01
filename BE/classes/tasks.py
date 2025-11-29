# classes/tasks.py
from celery import shared_task
from classes.utils import *
from classes.models import Speech, Bookmark
from lecture_docs.models import Page
from django.contrib.auth import get_user_model

User = get_user_model()

def save_temp_audio(audio_file):
    filename = f"{uuid.uuid4()}.wav"
    temp_path = os.path.join(settings.MEDIA_ROOT, "temp", filename)

    os.makedirs(os.path.dirname(temp_path), exist_ok=True)

    with open(temp_path, "wb") as f:
        for chunk in audio_file.chunks():
            f.write(chunk)

    return temp_path

@shared_task
def run_speech(speech_id, audio_path, page_id, user_id):
    speech = Speech.objects.get(id=speech_id)
    page = Page.objects.get(id=page_id)
    user = User.objects.get(id=user_id)

    try:
        stt_text, stt_words = speech_to_text(audio_path)

        s3_url = text_to_speech(stt_text, user, "tts/speech/")

        duration_sec, duration = get_duration(audio_path)
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
        raise e
    
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)