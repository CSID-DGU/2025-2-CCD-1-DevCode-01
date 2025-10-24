from django.db import models
from users.models import *
from dataclasses import dataclass, field
from typing import List, Dict
from app.models import Page

#stt
class Speech(models.Model):
    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='speeches', null=True, blank=True)
    stt = models.TextField(blank=True, null=True)
    stt_tts =  models.URLField(blank=True, null=True) 
    summary = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

#노트
class Note(models.Model):
    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='notes', null=True, blank=True)
    content = models.TextField()
    note_tts =  models.URLField(blank=True, null=True) 
    created_at = models.DateTimeField(auto_now_add=True)

#북마크
class Bookmark(models.Model):
    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='bookmarks', null=True, blank=True)
    timestamp = models.CharField(max_length=10) 
    created_at = models.DateTimeField(auto_now_add=True)

#시험 DB저장x
@dataclass
class Exam:
    title: str
    questions: List[Dict[str, str]] = field(default_factory=list)
