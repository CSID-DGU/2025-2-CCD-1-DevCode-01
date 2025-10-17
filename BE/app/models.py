import random
import string
from django.db import models
from django.contrib.auth.models import AbstractUser
from dataclasses import dataclass, field
from typing import List, Dict


#커스텀user
class User(AbstractUser):

    ROLE_CHOICES = [
        ('student', '장애학우'),('assistant', '학습도우미')]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    font = models.IntegerField(choices=[(125, '125%'), (150, '150%'), 
                                        (175, '175%'), (200, '200%')])
    high_contrast = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    

# 강의코드 발행
def lecture_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# 강의폴더
class Lecture(models.Model):
    student = models.ForeignKey(User, related_name='student_lecture', on_delete=models.CASCADE, null=True, blank=True)
    assistant = models.ForeignKey(User, related_name='assistant_lecture',  on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=100)
    code = models.CharField(max_length=10, unique=True, default=lecture_code)
    lecture_tts =  models.URLField(blank=True, null=True) 
    created_at = models.DateTimeField(auto_now_add=True)

    
#교안
class Doc(models.Model):
    lecture = models.ForeignKey(Lecture, on_delete=models.CASCADE, related_name='docs', null=True, blank=True)
    title = models.CharField(max_length=100)
    summary = models.TextField(blank=True, null=True)  
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title}"


# 페이지
class Page(models.Model):
    doc = models.ForeignKey(Doc, on_delete=models.CASCADE, related_name='pages', null=True, blank=True)
    page_number = models.IntegerField()
    image = models.ImageField(upload_to='docs/')  # 변환된 이미지 경로 (S3에 업로드)
    ocr = models.TextField(blank=True, null=True)  # OCR 결과 텍스트
    page_tts =  models.URLField(blank=True, null=True) 
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('doc', 'page_number')
        ordering = ['page_number']

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

#판서/필기
class Board(models.Model):
    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='boards',  null=True, blank=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(blank=True, null=True) 
    board_tts =  models.URLField(blank=True, null=True) 
    image = models.ImageField(upload_to='boards/', blank=True, null=True) #판서이미지
    created_at = models.DateTimeField(auto_now_add=True)


#stt
class Speech(models.Model):
    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='speeches', null=True, blank=True)
    stt = models.TextField(blank=True, null=True)
    stt_tts =  models.URLField(blank=True, null=True) 
    summary = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


#시험 DB저장x
@dataclass
class Exam:
    title: str
    questions: List[Dict[str, str]] = field(default_factory=list)

