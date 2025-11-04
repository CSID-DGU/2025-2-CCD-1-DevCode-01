from django.shortcuts import render
from django.http import JsonResponse
from classes.serializers import SpeechCreateSerializer
from classes.models import Speech
from classes.utils import speech_to_text, text_to_speech, text_to_speech_local
from lecture_docs.models import Page
from rest_framework.response import Response
from rest_framework import status, generics, permissions
import traceback
from rest_framework.views import APIView

"""
1. 음성 파일(STT 변환)
2. 변환된 텍스트(TTS 변환)
3. DB 저장
4. speechId, stt, tts, page 반환
"""
class SpeechView(generics.CreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pageId):
        try:
            user = request.user
            # ✅ 1️⃣ pageId로 Page 객체 조회
            page = Page.objects.get(id=pageId)
        except Page.DoesNotExist:
            return JsonResponse({"error": "해당 페이지를 찾을 수 없습니다."}, status=404)

        serializer = SpeechCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            audio = serializer.validated_data['audio']

            # 1️⃣ STT 변환
            stt_text = speech_to_text(audio)
            if not stt_text or stt_text.strip() == "":
                return JsonResponse({"error": "변환된 텍스트가 비어 있습니다."}, status=400)
            
            voice = (user.voice or "여성")
            rate = (user.rate or "보통")

            # 2️⃣ TTS 변환 + S3 업로드
            s3_url = text_to_speech(stt_text, voice, rate, s3_folder="tts/")

            # 3️⃣ DB 저장
            speech = Speech.objects.create(
                stt=stt_text,
                stt_tts=s3_url,
                page=page
            )

            # 성공 응답
            return JsonResponse({
                "speech_id": speech.id,
                "stt": stt_text,
                "stt_tts": s3_url,
                "page": page.page_number
            }, status=200)
        
        except Exception as e:
            traceback.print_exc()  # 서버 로그 출력용
            return JsonResponse(
                {"error": f"TTS 변환 중 오류가 발생했습니다: {str(e)}"},
                status=500
            )
        
class TTSTestView(APIView):
    """
    TTS 변환 로컬 저장 테스트용 API
    """
    def post(self, request):
        try:
            test_text = request.data["text"]
            voice = request.data["voice"]
            rate = request.data["rate"]

            # TTS 변환 (로컬에만 저장)
            local_path = text_to_speech_local(test_text, voice, rate)

            return JsonResponse({
                "message": "TTS 변환 성공",
                "test_text": test_text,
                "local_path": local_path
            }, status=200)

        except Exception as e:
            traceback.print_exc()
            return JsonResponse(
                {"error": f"TTS 테스트 중 오류 발생: {str(e)}"},
                status=500
            )