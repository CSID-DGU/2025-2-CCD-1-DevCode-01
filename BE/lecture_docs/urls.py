from django.urls import path
from .views import DocUploadView, DocDetailView

urlpatterns = [
    path('lecture/<int:lectureId>/doc/', DocUploadView.as_view(), name='doc-upload'),
    path('doc/<int:docId>/', DocDetailView.as_view(), name='doc-detail'),
]
