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
from classes.utils import text_to_speech
from .models import Doc, Page, Board
from lectures.models import Lecture
from .utils import  *


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
        try:
            tts_url = text_to_speech(
                page.ocr,
                user=request.user,
                s3_folder="tts/page_ocr/"
            )
        except Exception as e:
            return Response({"error": f"TTS 오류: {e}"}, status=500)

        page.page_tts = tts_url
        page.save(update_fields=["page_tts"])

        return Response({"tts": page.page_tts}, status=201)


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

        return Response({
            "doc_id": doc.id,
            "title": doc.title,
            "stt_summary": doc.stt_summary or None,
            "stt_summary_tts": doc.stt_summary_tts or None
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
        doc.stt_summary = summary
        doc.stt_summary_tts = tts_url
        doc.end_time = timestamp
        doc.save()

        return Response({
            "message": "STT 요약문 및 음성 파일이 성공적으로 생성되었습니다.",
            "doc_id": doc.id,
            "stt_summary": doc.stt_summary,
            "stt_summary_tts": doc.stt_summary_tts,
            "timestamp": doc.end_time
        }, status=status.HTTP_200_OK)

    def patch(self, request, docId):
        """요약문 직접 수정 시 TTS 재생성"""
        doc = self.get_object(docId)
        if not doc:
            return Response({"error": "해당 교안을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        new_summary = request.data.get("stt_summary")
        if not new_summary or not new_summary.strip():
            return Response({"error": "수정할 stt_summary 내용이 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        # ✅ 수정된 요약 저장
        doc.stt_summary = new_summary.strip()

        # ✅ 수정된 텍스트로 새 TTS 생성
        tts_url = text_to_speech(doc.stt_summary, user=request.user, s3_folder="tts/stt_summary/")
        doc.stt_summary_tts = tts_url
        doc.save()

        return Response({
            "message": "요약문이 성공적으로 수정되고 새 TTS가 생성되었습니다.",
            "doc_id": doc.id,
            "stt_summary": doc.stt_summary,
            "stt_summary_tts": doc.stt_summary_tts
        }, status=status.HTTP_200_OK)

#review    
class PageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pageId):
        try:
            page = Page.objects.get(id=pageId)
        except Page.DoesNotExist:
            return Response({"detail": "페이지를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user

        # page_data = {
        #     "doc_id": page.doc.id,
        #     "page_id": page.id,
        #     "page_number": page.page_number,
        #     "ocr": page.ocr or None,
        #     "page_tts": page.page_tts or None,
        #     "embedded_images": page.embedded_images or None,
        #     "image": page.image.url if page.image else None,
        # }

        note = Note.objects.filter(page=page, user=user).first()
        note_data = {
            "note_id": note.id,
            "content": note.content,
            "note_tts": note.note_tts or None,
        } if note else None

        speeches = Speech.objects.filter(page=page).order_by("-created_at")
        speech_data = [
            {
                "speech_id": speech.id,
                "stt": speech.stt,
                "stt_tts": speech.stt_tts or None,
                "end_time": speech.end_time,
                "duration": speech.duration,
            }
            for speech in speeches
        ]

        bookmarks = Bookmark.objects.filter(page=page, user=user).order_by("-created_at")
        bookmark_data = [
            {
                "bookmark_id": bookmark.id,
                "timestamp": bookmark.timestamp,
            }
            for bookmark in bookmarks
        ]

        return Response({
            # "page": page_data,
            "note": note_data,
            "speeches": speech_data,
            "bookmarks": bookmark_data,
            # "boards": board_data,
        }, status=status.HTTP_200_OK)
    

#시험 OCR
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
    
class ExamOCRView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if 'image' not in request.FILES:
            return Response({"error": "이미지를 업로드하세요."}, status=400)
        
        #임시 데이터
        ocr_text = "ocr text"  
        question_number = 1  

        tts_url = f"/exam/tts/?text={ocr_text}"

        response_data = {
            "totalQuestions": 10,
            "question": [
                {
                    "questionNumber": question_number,
                    "ocrText": ocr_text,
                    "tts": tts_url
                }
            ]
        }
        serializer = TotalExamSerializer(response_data)
        return Response(serializer.data, status=200)