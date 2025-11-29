from rest_framework import serializers
from .models import *


class SpeechCreateSerializer(serializers.Serializer):
    audio = serializers.FileField(required=True)
    timestamp = serializers.CharField(required=True)

class SpeechSerializer(serializers.ModelSerializer):
    speech_id = serializers.IntegerField(source="id", read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Speech
        fields = [
            "speech_id",
            "stt",
            "stt_tts",
            "end_time",
            "duration",
            "status"
        ]

    def get_status(self, obj):
        return "done" if obj.stt and obj.stt_tts else "processing"

class NoteSerializer(serializers.ModelSerializer):
    note_id = serializers.IntegerField(source="id", read_only=True)
    
    class Meta:
        model = Note
        fields = ["note_id", "content", "note_tts"]


class BookmarkSerializer(serializers.ModelSerializer):
    bookmark_id = serializers.IntegerField(source="id", read_only=True)

    class Meta:
        model = Bookmark
        fields = ["bookmark_id", "timestamp"]
