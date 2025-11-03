from django.urls import path
from classes.views import SpeechView

urlpatterns = [
    path('speech/<int:pageId>/', SpeechView.as_view(), name='speech_create'),
]