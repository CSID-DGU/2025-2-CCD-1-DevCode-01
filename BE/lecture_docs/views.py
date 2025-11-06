from django.shortcuts import get_object_or_404
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import fitz
from rest_framework.views import APIView
from rest_framework import status,permissions
from rest_framework.response import Response
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

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

        #all_sum = [] # 페이지 별 요약문 리스트

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

            Page.objects.create(
                doc=doc,
                page_number=page_num,
                ocr="텍스트 삽입예정입니다",
                image=page_image_file,            
            )

            # # 페이지별 요약문 생성
            # if text and text.strip():
            #     page_summary = summarize_doc(doc.id)
            #     all_sum.append(page_summary)

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
        summary, tts_url = summarize_stt(doc.id)

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
        tts_url = text_to_speech(doc.stt_summary, s3_folder="tts/stt_summary/")
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

    def get_object(self, docId):
        try:
            return Doc.objects.get(id=docId)
        except Doc.DoesNotExist:
            return None
        
    def get(self, request, docId):
        """교안 요약문 조회"""
        doc = self.get_object(docId)
        if not doc:
            return Response({"error": "해당 교안을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            "doc_id": doc.id,
            "title": doc.title,
            "summary": doc.summary or None,
            "page_tts": doc.page_tts or None
        }, status=status.HTTP_200_OK)

    def patch(self, request, docId):
        """교안 요약문 직접 수정 시 TTS 재생성"""
        doc = self.get_object(docId)
        if not doc:
            return Response({"error": "해당 교안을 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        new_summary = request.data.get("summary")
        if not new_summary or not new_summary.strip():
            return Response({"error": "수정할 summary 내용이 필요합니다."}, status=status.HTTP_400_BAD_REQUEST)

        # ✅ 수정된 요약 저장
        doc.summary = new_summary.strip()

        # ✅ 수정된 텍스트로 새 TTS 생성
        tts_url = text_to_speech(doc.summary, s3_folder="tts/doc_summary/")
        doc.page_tts = tts_url
        doc.save()

        return Response({
            "message": "요약문이 성공적으로 수정되고 새 TTS가 생성되었습니다.",
            "doc_id": doc.id,
            "summary": doc.summary,
            "page_tts": doc.page_tts
        }, status=status.HTTP_200_OK)