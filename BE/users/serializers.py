from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User

User = get_user_model()

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ['username', 'password', 'role', 'font', 'high_contrast', 'rate', 'voice']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            role=validated_data['role'],
            font=validated_data.get('font'),
            high_contrast=validated_data.get('high_contrast', False),
            rate = validated_data.get('rate'),
            voice = validated_data.get('voice')
        )
        return user

class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = user.role
        token['font'] = user.font
        token['high_contrast'] = user.high_contrast
        token['rate'] = user.rate
        token['voice'] = user.voice

        return token

class AccessibilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['font', 'high_contrast']

    def update(self, instance, validated_data):
        instance.font = validated_data.get('font', instance.font)
        instance.high_contrast = validated_data.get('high_contrast', instance.high_contrast)
        instance.save()
        return instance
    


class SoundOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['rate', 'voice']

    def update(self, instance, validated_data):
        instance.rate = validated_data.get('rate', instance.rate)
        instance.voice = validated_data.get('voice', instance.voice)
        instance.save()
        return instance