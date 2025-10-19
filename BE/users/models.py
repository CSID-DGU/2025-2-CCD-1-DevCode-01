from django.db import models
from django.contrib.auth.models import AbstractUser
# Create your models here.

#커스텀user
class User(AbstractUser):

    ROLE_CHOICES = [
        ('student', '장애학우'),('assistant', '학습도우미')]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    font = models.IntegerField(choices=[(125, '125%'), (150, '150%'), 
                                        (175, '175%'), (200, '200%')])
    high_contrast = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
