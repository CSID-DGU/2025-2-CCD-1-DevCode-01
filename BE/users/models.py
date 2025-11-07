from django.db import models
from django.contrib.auth.models import AbstractUser
# Create your models here.

#커스텀user
class User(AbstractUser):
    role = models.CharField(max_length=10, choices=[ ('student', '장애학우'),('assistant', '학습도우미')])
    font = models.CharField(max_length=10)
    high_contrast = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    rate=models.CharField(max_length=10)
    voice= models.CharField(max_length=10)
    