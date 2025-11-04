from django.urls import path
from classes.views import SpeechView, TTSTestView

urlpatterns = [
    path('speech/<int:pageId>/', SpeechView.as_view(), name='speech_create'),
    path('tts/test/', TTSTestView.as_view(), name='tts_test')
]