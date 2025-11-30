from rest_framework import serializers
from .models import Doc, Page, Board, SpeechSummary
from classes.models import Speech

class DocSerializer(serializers.ModelSerializer):
    docId = serializers.IntegerField(source="id")
    review = serializers.SerializerMethodField()
    createdAt = serializers.SerializerMethodField()
    timestamp = serializers.SerializerMethodField()  

    class Meta:
        model = Doc
        fields = ["docId", "title", "review", "createdAt", "timestamp"]

    def get_review(self, obj):
        return self.get_timestamp(obj) is not None

    def get_createdAt(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M")
    
    #가장 최근 endtime
    def get_timestamp(self, obj):
        latest = Speech.objects.filter(page__doc=obj).order_by("-end_time").first()
        return latest.end_time if latest else None


class DocUpdateSerializer(serializers.ModelSerializer):
    docId = serializers.IntegerField(source="id", read_only=True)

    class Meta:
        model = Doc
        fields = ["docId", "title"]


class PageSerializer(serializers.ModelSerializer):
    docId = serializers.IntegerField(source="doc.id")
    pagId = serializers.IntegerField(source="id")
    totalPage = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Page
        fields = [
            "docId",
            "page_number",
            "totalPage",
            "pagId",
            "image",
            "ocr",
            "status",
        ]

    def get_totalPage(self, obj):
        return obj.doc.pages.count()

    def get_status(self, obj):
        return "done" if obj.ocr else "processing"


class BoardCreateSerializer(serializers.Serializer):
    image = serializers.ImageField(required=True)


class BoardSerializer(serializers.ModelSerializer):
    boardId = serializers.IntegerField(source='id')

    class Meta:
        model = Board
        fields = ["boardId", "image", "text"]

class BoardReviewSerializer(serializers.ModelSerializer):
    boardId = serializers.IntegerField(source='id')
    board_tts = serializers.JSONField(read_only=True)

    class Meta:
        model = Board
        fields = ["boardId", "image", "text", "board_tts"]

class SpeechSummaryListSerializer(serializers.ModelSerializer):
    speechSummaryId = serializers.IntegerField(source="id")
    createdAt = serializers.SerializerMethodField()

    class Meta:
        model = SpeechSummary
        fields = ["speechSummaryId", "createdAt"]

    def get_createdAt(self, obj):
        return obj.created_at.strftime("%Y-%m-%d")

class SpeechSummarySerializer(serializers.ModelSerializer):
    speechSummaryId = serializers.IntegerField(source="id")
    docId = serializers.IntegerField(source="doc.id")
    createdAt = serializers.SerializerMethodField()
    stt_summary = serializers.CharField(source="summary")
    stt_summary_tts = serializers.JSONField(source="summary_tts")

    class Meta:
        model = SpeechSummary
        fields = ["speechSummaryId", "docId", "end_time", "stt_summary", "stt_summary_tts", "createdAt"]

    def get_createdAt(self, obj):
        return obj.created_at.strftime("%Y-%m-%d")