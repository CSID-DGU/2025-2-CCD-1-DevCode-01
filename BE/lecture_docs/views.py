import json
import os
import re
from urllib.parse import unquote
from io import BytesIO
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import fitz
import requests
from .serializers import *
from rest_framework.views import APIView
from rest_framework import status,permissions
from rest_framework.response import Response
from classes.models import Bookmark, Note, Speech
from classes.models import Bookmark, Note, Speech
from classes.utils import preprocess_code, text_to_speech
from .models import Doc, Page, Board
from lectures.models import Lecture
from .utils import  *
from classes.serializers import *
from datetime import datetime, timedelta, timezone
import redis
from dotenv import load_dotenv

#교안 업로드/조회
class DocUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    #교안 조회
    def get(self, request, lectureId):
        lecture = Lecture.objects.get(id=lectureId)

        docs = Doc.objects.filter(lecture=lecture).exclude(users=request.user)

        serializer = DocSerializer(docs, many=True)

        return Response({
            "lectureId": lecture.id,
            "doc": serializer.data
        }, status=status.HTTP_200_OK)
    #교안 업로드 
    def post(self, request, lectureId):
        lecture = get_object_or_404(Lecture, id=lectureId)
        file = request.FILES.get("file")

        if not file:
            return Response({"error": "file 필드가 비어 있습니다."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Doc 레코드 생성
        doc = Doc.objects.create(lecture=lecture, title=file.name)
        pdf_bytes = file.read() 

        pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = pdf_doc.page_count
        pdf_doc.close()

        # page 객체 생성
        for page_num in range(1, total_pages + 1):
            Page.objects.create(
                doc=doc,
                page_number=page_num,
                ocr=None,
                image=None,
        )
        # AI로 전송
        ai_ocr_url = settings.AI_OCR_URL
        callback_url = f"{settings.BACKEND_BASE_URL}/docs/{doc.id}/ocr-callback/"
        #로컬 테스트용
        #callback_url = request.build_absolute_uri(f"/docs/{doc.id}/ocr-callback/")
        files = {
            "file": (file.name, pdf_bytes, file.content_type),
        }

        data = {
            "doc_id": doc.id,
            "callback_url": callback_url,
        }

        try:
            resp = requests.post(ai_ocr_url, files=files, data=data, timeout=10)
            resp.raise_for_status()
        except Exception as e:
            return Response(
                {"error": f"AI 서버 요청 실패: {e}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"docId": doc.id, "title": doc.title}, status=201)
#BE<>AI
class OcrCallbackView(APIView):

    def post(self, request, docId):
        doc = get_object_or_404(Doc, id=docId)

        page_number = request.data.get("page_number")
        image_url = request.data.get("image_url")
        ocr_text = request.data.get("ocr_text")

        if not page_number or not ocr_text:
            return Response({"error": "page_number와 ocr_text는 필수입니다."},
                            status=status.HTTP_400_BAD_REQUEST)

        # Page 레코드 생성/갱신
        page_obj, _ = Page.objects.get_or_create(
            doc=doc,
            page_number=page_number,
            defaults={},
        )

        if image_url:
            page_obj.image = image_url

        page_obj.ocr = ocr_text
        page_obj.save(update_fields=["image", "ocr"])

        return Response({"message": "페이지 OCR 저장 완료"}, status=status.HTTP_200_OK)
    
#교안 TTS
class PageTTSView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, pageId):
        page = get_object_or_404(Page, id=pageId)

        if not page.ocr:
            return Response({"error": "OCR이 완료되지 않았습니다."}, status=400)
        
        if page.page_tts:
            return Response({"tts": page.page_tts}, status=200)

        # 수식 전처리된 OCR 텍스트
        # 없으면 원본 OCR 사용
        processed_math = request.data.get("ocr_text", page.ocr)
        
        # 1️⃣ <코드> ... </코드> 부분 추출
        code_pattern = re.compile(r"<코드>(.*?)</코드>", re.DOTALL)
        
        def replace_code(match):
            code_text = match.group(1)
            # 2️⃣ 코드 전처리
            processed_code = preprocess_code(code_text)
            return f"<코드>{processed_code}</코드>"

        preprocessed_text = code_pattern.sub(replace_code, processed_math)
        
        try:
            tts_url = text_to_speech(
                preprocessed_text,
                user=request.user,
                s3_folder="tts/page_ocr/"
            )
        except Exception as e:
            return Response({"error": f"TTS 오류: {e}"}, status=500)

        page.page_tts = tts_url
        page.save(update_fields=["page_tts"])

        return Response({"page_tts": page.page_tts}, status=201)


#교안 ocr 요약
class PageSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pageId):
        page = get_object_or_404(Page, id=pageId)

        if not page.ocr:
            return Response({"error": "OCR 완료 전입니다."}, status=400)

        if page.summary:
            return Response({
                "summary": page.summary,
                "summary_tts": page.summary_tts
            }, status=200)

        try:
            summary = summarize_doc(page.doc.id, page.ocr)
        except Exception as e:
            return Response({"error": f"요약 생성 실패: {e}"}, status=500)

        try:
            summary_tts = text_to_speech(
                summary,
                user=request.user,
                s3_folder="tts/page_summary/"
            )
        except Exception:
            summary_tts = None

        page.summary = summary
        page.summary_tts = summary_tts
        page.save(update_fields=["summary", "summary_tts"])

        return Response({
            "summary": page.summary,
            "summary_tts": page.summary_tts
        }, status=201)


#교안 수정 삭제
class DocDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self, docId):
        return get_object_or_404(Doc, id=docId)
    #교안 제목 수정
    def patch(self, request, docId):
        doc = self.get_object(docId)
        serializer = DocUpdateSerializer(doc, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=200)
        return Response(serializer.errors, status=400)
    #교안 삭제
    def delete(self, request, docId):
        doc = self.get_object(docId)

        doc.users.add(request.user)

        lecture_users = [doc.lecture.assistant, doc.lecture.student]
        deleted_users = list(doc.users.all())

        if all(u in deleted_users for u in lecture_users if u):
            doc.delete()
            return Response({"message": "파일이 삭제되었습니다."}, status=200)

        return Response({"message": "파일이 삭제되었습니다."}, status=200)

#페이지 교안조회
class PageDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, docId, pageNumber):

        try:
            doc = Doc.objects.get(id=docId)
        except Doc.DoesNotExist:
            return Response({"detail": "문서를 찾을 수 없습니다."},
                            status=status.HTTP_404_NOT_FOUND)

        page = doc.pages.get(page_number=pageNumber)
        data = PageSerializer(page).data

        if not page.ocr:
            return Response(data, status=status.HTTP_202_ACCEPTED)

        return Response(data, status=status.HTTP_200_OK)

    
#판서   
class BoardView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    #판서 조회
    def get(self, request, pageId):
        page = get_object_or_404(Page, id=pageId)
        boards = Board.objects.filter(page=page).order_by("-created_at")
        serializer = BoardSerializer(boards, many=True)

        return Response(
            {
                "pageId": page.id,
                "boards": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def post(self, request, pageId):
        serializer = BoardCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        page = get_object_or_404(Page, id=pageId)
        image = serializer.validated_data["image"]

        img_bytes = image.read()

        s3_stream = BytesIO(img_bytes)
        s3_key = f"boards/{page.id}_{image.name}"
        s3_url = upload_s3(s3_stream, s3_key, content_type=image.content_type)

        import base64
        image_b64 = base64.b64encode(img_bytes).decode()

        ai_url = settings.AI_BOARD_OCR_URL  
        try:
            import requests
            ai_resp = requests.post(
                ai_url,
                json={"image_base64": image_b64},
                timeout=12
            )
            ai_resp.raise_for_status()
            ocr_text = ai_resp.json().get("text", "")
        except Exception as e:
            return Response(
                {"error": f"AI 서버 요청 실패: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY
            )
        board = Board.objects.create(
            page=page,
            image=s3_url,
            text=ocr_text
        )

        # 웹소켓
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"doc_{page.doc.id}",
            {
                "type": "board_event",
                "event": "created",
                "data": {
                    "boardId": board.id,
                    "image": board.image,
                    "text": board.text,
                }
            }
        )

        # 8) 최종 응답 (serializer)
        return Response(BoardSerializer(board).data, status=status.HTTP_201_CREATED)

    #수정
    def patch(self, request, boardId):
        board = get_object_or_404(Board, id=boardId)
        new_text = request.data.get("text")

        if new_text is None:
            return Response({"error": "text 필드가 필요합니다."}, status=400)

        board.text = new_text
        board.save(update_fields=["text"])

        # 웹소켓
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"doc_{board.page.doc.id}",
            {
                "type": "board_event",
                "event": "updated",
                "data": {
                    "boardId": board.id,
                    "text": board.text,
                }
            }
        )
        return Response(BoardSerializer(board).data, status=status.HTTP_200_OK)

    #삭제
    def delete(self, request, boardId):
        board = get_object_or_404(Board, id=boardId)
        page = board.page
        board_id = board.id

        board.delete()

        # 웹소켓
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"doc_{page.doc.id}",
            {
                "type": "board_event",
                "event": "deleted",
                "data": {
                    "boardId": board_id
                }
            }
        )

        return Response({"message": "판서가 삭제되었습니다."}, status=status.HTTP_200_OK)


# 교수발화 요약  
class DocSttSummaryView(APIView):
    """
    교안 STT 요약문 생성 및 수정
    """

    def get_object(self, docId):
        try:
            return Doc.objects.get(id=docId)
        except Doc.DoesNotExist:
            return None
        
    def get(self, request, docId):
        """STT 요약문 조회"""
        doc = self.get_object(docId)
        if not doc:
            return Response({"error": "해당 교안을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)
        
        summaries = SpeechSummary.objects.filter(doc=doc).order_by("created_at")
        serializer = SpeechSummaryListSerializer(summaries, many=True)

        return Response({
            "summaries": serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request, docId):
        """수업 종료 시 Gemini 기반 자동 요약 생성"""
        doc = self.get_object(docId)
        if not doc:
            return Response({"error": "해당 교안을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        timestamp = request.data.get("timestamp") # 수업 종료 시점
        
        # ✅ 요약 + TTS 생성
        summary, tts_url = summarize_stt(doc.id, user=request.user)

        # ✅ 결과 DB 반영
        speech_sum = SpeechSummary.objects.create(
            doc=doc,
            end_time=timestamp,
            summary=summary,
            summary_tts=tts_url
        )

        doc.end_time = timestamp
        doc.save(update_fields=['end_time'])

        return Response({
            "message": "STT 요약문 및 음성 파일이 성공적으로 생성되었습니다.",
            "doc_id": doc.id,
            "stt_summary": speech_sum.summary,
            "stt_summary_tts": speech_sum.summary_tts,
            "timestamp": speech_sum.end_time
        }, status=status.HTTP_200_OK)
    
class DocSttSummaryDetailView(APIView):
    def get_object(self, speechSummaryId):
        try:
            return SpeechSummary.objects.get(id=speechSummaryId)
        except SpeechSummary.DoesNotExist:
            return None
        
    def get(self, request, speechSummaryId):
        """특정 STT 요약문 조회"""
        speech_sum = self.get_object(speechSummaryId)
        if not speech_sum:
            return Response({"error": "해당 요약을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = SpeechSummarySerializer(speech_sum)

        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def patch(self, request, speechSummaryId):
        """요약문 직접 수정 시 TTS 재생성"""
        speech_sum = self.get_object(speechSummaryId)
        if not speech_sum:
            return Response({"error": "해당 요약을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        new_summary = request.data.get("stt_summary")
        if not new_summary or not new_summary.strip():
            return Response({"error": "수정할 stt_summary 내용이 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        # ✅ 수정된 요약 저장
        speech_sum.summary = new_summary.strip()

        # ✅ 수정된 텍스트로 새 TTS 생성
        tts_url = text_to_speech(speech_sum.summary, user=request.user, s3_folder="tts/stt_summary/")
        speech_sum.summary_tts = tts_url
        speech_sum.save()

        return Response({
            "message": "요약문이 성공적으로 수정되고 새 TTS가 생성되었습니다.",
            "doc_id": speech_sum.doc.id,
            "stt_summary": speech_sum.summary,
            "stt_summary_tts": speech_sum.summary_tts,
            "timestamp": speech_sum.end_time
        }, status=status.HTTP_200_OK)

#review    
class PageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pageId):
        try:
            page = Page.objects.get(id=pageId)
        except Page.DoesNotExist:
            return Response({"detail": "페이지를 찾을 수 없습니다."}, status=404)

        user = request.user

        note = Note.objects.filter(page=page, user=user).first()
        speeches = Speech.objects.filter(page=page).order_by("-created_at")
        bookmarks = BookmarkSerializer(
            Bookmark.objects.filter(page=page, user=user).order_by("-created_at"),
            many=True
        ).data

        response_data = {
            "note": NoteSerializer(note).data if note else None,
            "speeches": SpeechSerializer(speeches, many=True).data,
            "bookmarks": bookmarks,
        }

        return Response(response_data, status=200)

#시험 OCR
load_dotenv()
redis_client = redis.Redis.from_url(os.getenv("EXAM_REDIS_URL"))

class ExamTTSView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        text = request.query_params.get("text")
        if not text:
            return Response({"error": "text 파라미터 필요"}, status=400)

        decoded_text = unquote(text)
        audio_bytes = exam_tts(decoded_text, request.user)

        response = HttpResponse(audio_bytes, content_type="audio/mp3")
        response["Content-Disposition"] = 'inline; filename="tts.mp3"'
        return response

#시험 시작
class ExamStartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user

        end_time = request.data.get("endTime")
        images = request.FILES.getlist("images")

        if not end_time:
            return Response({"error": "endTime 필요"}, status=400)
        if not images:
            return Response({"error": "images[] 필요"}, status=400)

        # 문자열 → datetime으로 검증
        try:
            end_time = datetime.fromisoformat(end_time)
        except:
            return Response({"error": "endTime 형식 오류"}, status=400)

        # Redis 저장
        session_key = f"exam_session:{user.id}"
        redis_client.set(session_key, json.dumps({"endTime": end_time}))

        # OCR 처리
        ai_url = settings.AI_EXAM_OCR_URL
        all_questions = []

        for image in images:
            files = {
                "image": (image.name, image.read(), image.content_type)
            }
            ai_resp = requests.post(ai_url, files=files, timeout=60)
            ai_resp.raise_for_status()

            ocr_json = ai_resp.json()
            all_questions.extend(ocr_json.get("questions", []))

        ocr_key = f"exam_ocr:{user.id}"
        redis_client.set(ocr_key, json.dumps(all_questions))

        return Response({
            "message": "시험 시작됨",
            "endTime": end_time,
            "questions": all_questions
        }, status=200)



#분석 결과
class ExamResultView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        session_key = f"exam_session:{user.id}"
        ocr_key = f"exam_ocr:{user.id}"

        session_val = redis_client.get(session_key)
        if not session_val:
            return Response({"error": "시험 종료됨"}, status=403)

        session = json.loads(session_val)
        end_time = datetime.fromisoformat(session["endTime"])

        # 종료 검증
        if datetime.now(timezone.utc) > end_time:
            return Response({"error": "시험 종료됨"}, status=403)

        # OCR 데이터 반환
        cached = redis_client.get(ocr_key)
        if not cached:
            return Response({"error": "OCR 없음"}, status=404)

        return Response({
            "endTime": session["endTime"],
            "questions": json.loads(cached)
        }, status=200)


#시험 종료
class ExamEndView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user

        session_key = f"exam_session:{user.id}"
        ocr_key = f"exam_ocr:{user.id}"

        redis_client.delete(session_key)
        redis_client.delete(ocr_key)

        return Response({"message": "시험 종료됨"}, status=200)
