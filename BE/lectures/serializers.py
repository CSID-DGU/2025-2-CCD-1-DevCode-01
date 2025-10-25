from rest_framework import serializers
from .models import Lecture
from users.models import User

class LectureSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lecture
        fields = ['id', 'title', 'code', 'lecture_tts', 'created_at']

class LectureCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lecture
        fields = ['title']

    def create(self, validated_data):
        user = self.context['request'].user

        # ✅ 사용자 역할에 따라 student 또는 assistant로 구분 저장
        if user.role == 'student':
            return Lecture.objects.create(student=user, **validated_data)
        elif user.role == 'assistant':
            return Lecture.objects.create(assistant=user, **validated_data)
        else:
            raise serializers.ValidationError("유효하지 않은 사용자 역할입니다.")

class LectureUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lecture
        fields = ['title']

    def update(self, instance, validated_data):
        instance.title = validated_data.get('title', instance.title)
        instance.save()
        return instance