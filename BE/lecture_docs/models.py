from typing import Dict, List
from django.db import models
from users.models import *
from lectures.models import *
from dataclasses import dataclass, field


#교안
class Doc(models.Model):
    lecture = models.ForeignKey(Lecture, on_delete=models.CASCADE, related_name='docs', null=True, blank=True)
    title = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    end_time = models.CharField(max_length=10, blank=True, null=True)
    users = models.ManyToManyField("users.User", blank=True, related_name="hidden_docs")
    def __str__(self):
        return f"{self.title}"


# 페이지
class Page(models.Model):
    doc = models.ForeignKey(Doc, on_delete=models.CASCADE, related_name='pages', null=True, blank=True)
    page_number = models.IntegerField()
    image = models.URLField(blank=True, null=True)
    ocr = models.TextField(blank=True, null=True)  # OCR 결과 텍스트
    page_tts =  models.URLField(blank=True, null=True) 
    summary = models.TextField(blank=True, null=True) 
    summary_tts = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('doc', 'page_number')
        ordering = ['page_number']


#판서/필기
class Board(models.Model):
    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='boards',  null=True, blank=True)
    text = models.TextField(blank=True, null=True) 
    board_tts =  models.URLField(blank=True, null=True) 
    image = models.URLField(blank=True, null=True) #판서이미지
    created_at = models.DateTimeField(auto_now_add=True)


# 발화 요약
class SpeechSummary(models.Model):
    doc = models.ForeignKey(Doc, on_delete=models.CASCADE, related_name='speech_summaries', null=True, blank=True)
    end_time = models.CharField(max_length=10)
    summary = models.TextField(blank=True, null=True)
    summary_tts =  models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)