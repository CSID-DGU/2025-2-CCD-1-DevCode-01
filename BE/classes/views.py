from django.shortcuts import render
from django.http import JsonResponse
from common.service.tts_service import text_to_speech
from common.service.stt_service import speech_to_text
from classes.serializers import SpeechCreateSerializer
from classes.models import Speech
from rest_framework.response import Response
from rest_framework import status, generics
import traceback

"""
1. 음성 파일(STT 변환)
2. 변환된 텍스트(TTS 변환)
3. DB 저장
4. speechId, stt, tts, page 반환
"""
class SpeechCreateView(generics.CreateAPIView):
    def post(self, request):
        serializer = SpeechCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            audio = serializer.validated_data['audio']
            # page = serializer.validated_data.get('page')

            # 1️⃣ STT 변환
            stt_text = speech_to_text(audio)

            # 2️⃣ TTS 변환 + S3 업로드
            s3_url = text_to_speech(stt_text, s3_folder="tts/")

            # 3️⃣ DB 저장
            speech = Speech.objects.create(
                stt=stt_text,
                stt_tts=s3_url,
                # page_id=page
            )

            # 성공 응답
            return JsonResponse({
                "speechId": speech.id,
                "stt": stt_text,
                "stt_tts": s3_url,
                # "page": page
            }, status=200)

        except Exception as e:
            traceback.print_exc()  # 서버 로그 출력용
            return JsonResponse(
                {"error": f"TTS 변환 중 오류가 발생했습니다: {str(e)}"},
                status=500
            )