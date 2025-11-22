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