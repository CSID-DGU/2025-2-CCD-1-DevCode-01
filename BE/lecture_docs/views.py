from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import fitz
from rest_framework.views import APIView
from rest_framework import status,permissions
from rest_framework.response import Response
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from classes.models import Bookmark, Note, Speech
from classes.utils import text_to_speech
from .models import Doc, Page, Board
from lectures.models import Lecture
from .utils import  pdf_to_image, summarize_stt


class DocUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    #파일목록조회
    def get(self, request, lectureId):
        lecture = Lecture.objects.get(id=lectureId)
        
        docs = Doc.objects.filter(lecture=lecture).exclude(users=request.user)

        data = {
            "lectureId": lecture.id,
            "doc": [
                {
                    "docId": d.id,
                    "title": d.title,
                    "review": True if d.stt_summary else False,                    
                    "createdAt": d.created_at.strftime("%Y-%m-%d %H:%M")
                }
                for d in docs
            ]
        }
        return Response(data, status=status.HTTP_200_OK)
    #파일업로드
    def post(self, request, lectureId):
        lecture = Lecture.objects.get(id=lectureId)
        file = request.FILES.get("file")

        doc = Doc.objects.create(lecture=lecture, title=file.name)

        pdf = fitz.open(stream=file.read(), filetype="pdf")

        file.seek(0)
        #page_texts = pdf_to_text(file)

        # for page_num, page in enumerate(pdf, start=1):
        #     text = page_texts[page_num - 1] if page_num - 1 < len(page_texts) else ""
        #     embedded_images = pdf_to_embedded_images(page, pdf)

        #     image_urls = []

        for page_num, page in enumerate(pdf, start=1):
            #text = page_texts[page_num - 1] if page_num - 1 < len(page_texts) else ""
            #embedded_images = pdf_to_embedded_images(page, pdf)
            page_image_file = pdf_to_image(page, doc.title, page_num)

            #image_urls = []

            # for img_data in embedded_images:
            #     image_file = ContentFile(img_data["bytes"], name=img_data["name"])
            #     s3_path = default_storage.save(f"embedded/{img_data['name']}", image_file)
            #     image_urls.append(default_storage.url(s3_path))

            # 페이지별 요약문 생성
#             if text and text.strip():
#                 try:
#                     summary = summarize_doc(doc.id, text)
#                     summary_tts = text_to_speech(summary, user=request.user, s3_folder="tts/page_summary/")
#                 except Exception as e:
#                     raise ValueError(f"[{page_num}] 페이지 요약 생성 실패: {e}")

            Page.objects.create(
                doc=doc,
                page_number=page_num,
                ocr="텍스트 삽입예정입니다",
                image=page_image_file,            
                embedded_images=image_urls or None,
                summary=summary if text else None,
                summary_tts=summary_tts if text else None,
            )

        pdf.close()
        
        # 페이지별 요약문 병합 후 doc 요약문 및 TTS 생성
        # combined_summary = "\n\n".join(
        #     [f"[{idx+1} 페이지] {summary}" for idx, summary in enumerate(all_sum)]
        # ).strip()
        # doc.summary = combined_summary
        # doc.save(update_fields=["summary"])

        # tts_url = text_to_speech(combined_summary, s3_folder="tts/doc_summary/")
        # doc.page_tts = tts_url
        # doc.save(update_fields=["page_tts"])

        return Response({
            "docId": doc.id,
            "docTitle": doc.title,
        }, status=status.HTTP_201_CREATED)

class DocDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get_queryset(self):
        return Doc.objects.all()    
    
    def patch(self, request, docId):
            doc = self.get_queryset().get(id=docId)
            new_title = request.data.get("title")
            doc.title = new_title
            doc.save()
            return Response({"docId": doc.id, "title": doc.title}, status=200)

    def delete(self, request, docId):
        doc = self.get_queryset().get(id=docId)

        doc.users.add(request.user)

        lecture_users = [doc.lecture.assistant, doc.lecture.student] 
        deleted_users = list(doc.users.all())

        if all(u in deleted_users for u in lecture_users if u is not None):
            doc.delete()
            return Response({"message": "파일이 삭제되었습니다."}, status=200)


        return Response({"message": "파일이 삭제되었습니다."}, status=200)



class PageDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, docId, pageNumber):
        try:
            doc = Doc.objects.get(id=docId)
        except Doc.DoesNotExist:
            return Response({"detail": "문서를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        try:
            page = doc.pages.get(page_number=pageNumber)
        except Page.DoesNotExist:
            return Response({"detail": "페이지를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
                "docId": doc.id,
                "pageNumber": page.page_number,
                "pagId": page.id,
                "image": page.image.url if page.image else None,
                "ocr": page.ocr if page.ocr else None,
                "sum": None,  
                "tts": None,   
            }, status=status.HTTP_200_OK)
    
class BoardView(APIView):

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pageId):
        page = get_object_or_404(Page, id=pageId)
        boards = Board.objects.filter(page=page).order_by("-created_at")

        data = [
            {
                "boardId": b.id,
                "image": b.image.url if b.image else None,
                "text": b.text or None
            }
            for b in boards
        ]
        return Response({"pageId": page.id, "boards": data}, status=status.HTTP_200_OK)

    def post(self, request, pageId):
        page = get_object_or_404(Page, id=pageId)
        image = request.FILES.get("image")

        if not image:
            return Response({"error": "판서 이미지가 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        image_path = default_storage.save(f"boards/{image.name}", ContentFile(image.read()))

        board = Board.objects.create(
            page=page,
            image=image_path,
            text=None,  
        )

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"doc_{page.doc.id}",
            {
                "type": "board.event",
                "event": "created",
                "data": { 
                    "boardId": board.id,
                    "image": default_storage.url(image_path),
                    "text": board.text,
                }
            },
        )

        return Response(
            {
                "boardId": board.id,
                "text": board.text,  
                "image": default_storage.url(image_path)
            },
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request, boardId):
        board = get_object_or_404(Board, id=boardId)
        new_text = request.data.get("text")
        board.text = new_text
        board.save()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"doc_{board.page.doc.id}",
            {
                "type": "board.event",
                "event": "updated",
                "data": {  
                    "boardId": board.id,
                    "text": board.text,
                }                

            },
        )
        
        return Response(
            {
                "boardId": board.id,
                "text": board.text
            },
            status=status.HTTP_200_OK,
        )
    def delete(self, request, boardId):
        board = get_object_or_404(Board, id=boardId)
        page = board.page
        board_id = board.id

        board.delete()

        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"doc_{page.doc.id}",
            {
                "type": "board.event",
                "event": "deleted",
                "data": {
                    "boardId": board_id,
                },
            },
        )

        return Response({"message": "판서가 삭제되었습니다."}, status=status.HTTP_200_OK)
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

        # ✅ 요약 + TTS 생성
        summary, tts_url = summarize_stt(doc.id, user=request.user)

        # ✅ 결과 DB 반영
        doc.stt_summary = summary
        doc.stt_summary_tts = tts_url
        doc.save()

        return Response({
            "message": "STT 요약문 및 음성 파일이 성공적으로 생성되었습니다.",
            "doc_id": doc.id,
            "stt_summary": doc.stt_summary,
            "stt_summary_tts": doc.stt_summary_tts
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
    
class DocSummaryView(APIView):
    """
    교안 OCR 요약문 조회 및 수정
    """

    def get_object(self, pageId):
        try:
            return Page.objects.get(id=pageId)
        except Page.DoesNotExist:
            return None
        
    def get(self, request, pageId):
        """교안 요약문 조회"""
        page = self.get_object(pageId)
        if not page:
            return Response({"error": "해당 페이지를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "page_id": page.id,
            "summary": page.summary or None,
            "summary_tts": page.summary_tts or None
        }, status=status.HTTP_200_OK)

    def patch(self, request, pageId):
        """교안 요약문 직접 수정 시 TTS 재생성"""
        page = self.get_object(pageId)
        if not page:
            return Response({"error": "해당 페이지를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        new_summary = request.data.get("summary")
        if not new_summary or not new_summary.strip():
            return Response({"error": "수정할 summary 내용이 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        # ✅ 수정된 요약 저장
        page.summary = new_summary.strip()

        # ✅ 수정된 텍스트로 새 TTS 생성
        tts_url = text_to_speech(page.summary, user=request.user, s3_folder="tts/page_summary/")
        page.summary_tts = tts_url
        page.save()

        return Response({
            "message": "요약문이 성공적으로 수정되고 새 TTS가 생성되었습니다.",
            "page_id": page.id,
            "summary": page.summary,
            "summary_tts": page.summary_tts
        }, status=status.HTTP_200_OK)
    
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

        # boards = Board.objects.filter(page=page).order_by("-created_at")
        # board_data = [
        #     {
        #         "board_id": board.id,
        #         "text": board.text or None,
        #         "image": board.image.url if board.image else None,
        #         "board_tts": board.board_tts or None,
        #     }
        #     for board in boards
        # ]

        return Response({
            # "page": page_data,
            "note": note_data,
            "speeches": speech_data,
            "bookmarks": bookmark_data,
            # "boards": board_data,
        }, status=status.HTTP_200_OK)