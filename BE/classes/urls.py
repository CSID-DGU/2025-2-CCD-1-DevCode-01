from django.urls import path
from classes.views import SpeechCreateView

urlpatterns = [
    path('speech/create/', SpeechCreateView.as_view(), name='speech_create'),
]