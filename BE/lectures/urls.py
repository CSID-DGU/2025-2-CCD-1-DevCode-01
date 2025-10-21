from django.urls import path
from .views import LectureCreateView, LectureJoinView, LectureListView, LectureUpdateView

urlpatterns = [
    path('', LectureListView.as_view(), name='lecture_list'),       # GET /api/lecture/
    path('create/', LectureCreateView.as_view(), name='lecture_create'),  # POST /api/lecture/
    path('<int:pk>/', LectureUpdateView.as_view(), name='lecture_update'), # PATCH /api/lecture/1/
    path('join/', LectureJoinView.as_view(), name='lecture_join'),       # POST /api/lecture/join/
]
