from django.urls import path
from .views import LectureView, LectureDetailView, LectureJoinView, SharedNoteView

urlpatterns = [
    path('', LectureView.as_view(), name='lecture'),
    path('<int:lectureId>/', LectureDetailView.as_view(), name='lecture_detail'),
    path('join/', LectureJoinView.as_view(), name='lecture_join'),
    path('<int:lectureId>/note/', SharedNoteView.as_view(), name='shared_note'),
    # path('note/<int:noteId>/', SharedNoteDetailView.as_view(), name='shared_note_detail'),
]
