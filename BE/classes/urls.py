from django.urls import path
from classes.views import BookmarkDetailView, BookmarkView, SpeechView, TTSTestView

urlpatterns = [
    path('speech/<int:pageId>/', SpeechView.as_view(), name='speech_create'),
    path('tts/test/', TTSTestView.as_view(), name='tts_test'),
    path('<int:pageId>/bookmark/', BookmarkView.as_view(), name='bookmark_create'),
    path('bookmark/<int:bookmarkId>/', BookmarkDetailView.as_view(), name='bookmark_detail'),
]