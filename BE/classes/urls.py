from django.urls import path
from classes.views import BookmarkDetailView, BookmarkView, NoteDetailView, NoteTTSView, NoteView, SpeechView, TTSTestView

urlpatterns = [
    path('speech/<int:pageId>/', SpeechView.as_view(), name='speech_create'),
    path('tts/test/', TTSTestView.as_view(), name='tts_test'),
    path('<int:pageId>/bookmark/', BookmarkView.as_view(), name='bookmark_create'),
    path('bookmark/<int:bookmarkId>/', BookmarkDetailView.as_view(), name='bookmark_detail'),
    path('<int:pageId>/note/', NoteView.as_view(), name='note_create'),
    path('note/<int:noteId>/', NoteDetailView.as_view(), name='note_detail'),
    path('note/<int:noteId>/tts/', NoteTTSView.as_view(), name='note_tts'),
]