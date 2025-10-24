import random
import string
from django.db import models
from users.models import *

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

#판서/필기
class Board(models.Model):
    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='boards',  null=True, blank=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(blank=True, null=True) 
    board_tts =  models.URLField(blank=True, null=True) 
    image = models.ImageField(upload_to='boards/', blank=True, null=True) #판서이미지
    created_at = models.DateTimeField(auto_now_add=True)