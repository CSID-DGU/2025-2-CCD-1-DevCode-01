from rest_framework import serializers

class SpeechCreateSerializer(serializers.Serializer):
    audio = serializers.FileField(required=True, help_text="STT 변환할 음성 파일")
    page = serializers.IntegerField(required=False, help_text="페이지 번호")