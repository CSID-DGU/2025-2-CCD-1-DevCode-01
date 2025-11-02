from django.db import models
from django.contrib.auth.models import AbstractUser
# Create your models here.

#커스텀user
class User(AbstractUser):
    role = models.CharField(max_length=10, choices=[ ('student', '장애학우'),('assistant', '학습도우미')])
    font = models.IntegerField(choices=[(125, '125%'), (150, '150%'), (175, '175%'), (200, '200%')])
    high_contrast = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    rate=models.CharField(max_length=10, choices=[('느림','느림'),('보통','보통'),('빠름','빠름')])
    voice= models.CharField(max_length=10, choices=[('여성','여성'),('남성','남성')])
