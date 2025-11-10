from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from users.views import *

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'), 
    path('refresh/', TokenRefreshView.as_view(), name='refresh'),
    path('accessibility/', AccessibilityView.as_view(), name='accessibility'),
    path('soundoption/', SoundOptionView.as_view(), name='soundoption'),
]