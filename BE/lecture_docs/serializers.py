from rest_framework import serializers
from .models import Doc, Page


class DocSerializer(serializers.ModelSerializer):
    docId = serializers.IntegerField(source="id")
    review = serializers.SerializerMethodField()
    createdAt = serializers.SerializerMethodField()

    class Meta:
        model = Doc
        fields = ["docId", "title", "review", "createdAt"]

    def get_review(self, obj):
        return True if obj.stt_summary else False

    def get_createdAt(self, obj):
        return obj.created_at.strftime("%Y-%m-%d %H:%M")

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

class ExamSerializer(serializers.Serializer):
    questionNumber = serializers.IntegerField(allow_null=True)
    ocrText = serializers.CharField(allow_null=True)
    tts = serializers.CharField(allow_null=True)

class TotalExamSerializer(serializers.Serializer):
    totalQuestions = serializers.IntegerField(allow_null=True)
    question = ExamSerializer(many=True)
