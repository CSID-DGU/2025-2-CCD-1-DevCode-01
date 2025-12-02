from django.urls import path
from .views import *

urlpatterns = [
    # BE <> FE
    path('lecture/<int:lectureId>/doc/', DocUploadView.as_view(), name='doc-upload'),
    path('doc/<int:docId>/', DocDetailView.as_view(), name='doc-detail'),
    path('doc/<int:docId>/<int:pageNumber>/', PageDetailView.as_view(), name='page-detail'),
    
    path('page/<int:pageId>/tts/', PageTTSView.as_view(), name='tts-upload'),
    path('page/<int:pageId>/board/', BoardView.as_view(), name='board-upload'),
    path("page/<int:pageId>/summary/", PageSummaryView.as_view(), name="doc-summary"),
    path("page/<int:pageId>/summary/tts/", PageSummaryTTSView.as_view(), name="doc-summary-tts"),
    
    path('page/<int:pageId>/review/', PageView.as_view(), name='page-review'),
    path('board/<int:boardId>/', BoardView.as_view(), name="board-detail"),
    path('board/<int:boardId>/tts/', BoardTTSView.as_view(), name='board-tts'),
    path("doc/<int:docId>/speech/summary/", DocSttSummaryView.as_view(), name="doc-stt-summary"),
    path("doc/speech/summary/<int:speechSummaryId>/", DocSttSummaryDetailView.as_view(), name="doc-stt-summary-detail"),

    path('exam/start/', ExamStartView.as_view(), name='exam'),
    path('exam/result/',  ExamResultView.as_view(), name='exam-result'),
    path("exam/tts/", ExamTTSView.as_view()),
    path('exam/end/',  ExamEndView.as_view(), name='exam-result'),

    ## BE <> AI
    path("docs/<int:docId>/ocr-callback/", OcrCallbackView.as_view(), name="doc-ocr-callback"),
]