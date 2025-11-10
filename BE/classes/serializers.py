from rest_framework import serializers

class SpeechCreateSerializer(serializers.Serializer):
    audio = serializers.FileField(required=True, help_text="STT 변환할 음성 파일")
    timestamp = serializers.CharField(required=False, help_text="음성 업로드 시점 (hh:mm:ss 형식)")