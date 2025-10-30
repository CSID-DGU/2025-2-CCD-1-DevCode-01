from django.urls import path
from .views import *

urlpatterns = [
    path('lecture/<int:lectureId>/doc/', DocUploadView.as_view(), name='doc-upload'),
    path('doc/<int:docId>/', DocDetailView.as_view(), name='doc-detail'),
    path('doc/<int:docId>/<int:pageNumber>/', PageDetailView.as_view(), name='page-detail'),
]
