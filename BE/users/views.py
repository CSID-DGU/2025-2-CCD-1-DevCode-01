from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status, generics
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import LoginSerializer, SignupSerializer
from .models import User

class SignupView(generics.CreateAPIView):
    serializer_class = SignupSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        return Response({
            "message": "회원가입 완료",
            "username": user.username,
        }, status=status.HTTP_201_CREATED)

class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.user
        tokens = serializer.validated_data 

        return Response({
            "message": "로그인 성공",
            "username": user.username,
            "role": user.role,
            "font": user.font,
            "high_contrast": user.high_contrast,            
            "access": tokens.get("access"),
            "refresh": tokens.get("refresh"),
        }, status=status.HTTP_200_OK)
