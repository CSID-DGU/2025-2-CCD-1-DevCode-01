from django.urls import path
from .views import LectureView, LectureDetailView, LectureJoinView

urlpatterns = [
    path('', LectureView.as_view(), name='lecture'),
    path('<int:lectureId>/', LectureDetailView.as_view(), name='lecture_detail'),
    path('join/', LectureJoinView.as_view(), name='lecture_join'),
]
