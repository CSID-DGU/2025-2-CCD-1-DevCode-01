from rest_framework import serializers
from .models import Doc, Page


class PageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Page
        fields = ['page_number', 'image', 'ocr', 'created_at']


class DocSerializer(serializers.ModelSerializer):
    pages = PageSerializer(many=True, read_only=True)

    class Meta:
        model = Doc
        fields = ['id', 'lecture', 'title', 'pages', 'created_at']
