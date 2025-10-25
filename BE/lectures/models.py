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