from rest_framework import serializers
from app.models import Lecture
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

        # ✅ 장애학우만 강의 생성 가능
        if user.role == 'student':
            return Lecture.objects.create(student=user, **validated_data)
        else:
            raise serializers.ValidationError("강의폴더는 장애학우만 생성할 수 있습니다.")
        
class LectureUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lecture
        fields = ['title']

    def update(self, instance, validated_data):
        instance.title = validated_data.get('title', instance.title)
        instance.save()
        return instance