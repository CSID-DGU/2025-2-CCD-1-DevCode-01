from django.db import models
from users.models import *
from lectures.models import *
from dataclasses import dataclass, field


#교안
class Doc(models.Model):
    lecture = models.ForeignKey(Lecture, on_delete=models.CASCADE, related_name='docs', null=True, blank=True)
    title = models.CharField(max_length=100)
    summary = models.TextField(blank=True, null=True) 
    page_tts =  models.URLField(blank=True, null=True) 
    created_at = models.DateTimeField(auto_now_add=True)
    stt_summary = models.TextField(blank=True, null=True)
    stt_summary_tts = models.URLField(blank=True, null=True)
    def __str__(self):
        return f"{self.title}"


# 페이지
class Page(models.Model):
    doc = models.ForeignKey(Doc, on_delete=models.CASCADE, related_name='pages', null=True, blank=True)
    page_number = models.IntegerField()
    image = models.ImageField(upload_to='docs/')  # 변환된 이미지 경로 (S3에 업로드)
    embedded_images = models.JSONField(blank=True, null=True)
    ocr = models.TextField(blank=True, null=True)  # OCR 결과 텍스트
    page_tts =  models.URLField(blank=True, null=True) 
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('doc', 'page_number')
        ordering = ['page_number']


#판서/필기
class Board(models.Model):
    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='boards',  null=True, blank=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(blank=True, null=True) 
    board_tts =  models.URLField(blank=True, null=True) 
    image = models.ImageField(upload_to='boards/', blank=True, null=True) #판서이미지
    created_at = models.DateTimeField(auto_now_add=True)