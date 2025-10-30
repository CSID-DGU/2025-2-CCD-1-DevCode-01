import fitz
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from .models import Doc, Page
from lectures.models import Lecture
from .utils import pdf_to_text, pdf_to_image, pdf_to_embedded_images


class DocUploadView(generics.CreateAPIView):
    #파일목록조회
    def get(self, request, lectureId):
        lecture = Lecture.objects.get(id=lectureId)
        
        docs = Doc.objects.filter(lecture=lecture).order_by("-created_at")

        data = {
            "lectureId": lecture.id,
            "doc": [
                {
                    "docId": d.id,
                    "title": d.title,
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
        page_texts = pdf_to_text(file)
        for page_num, page in enumerate(pdf, start=1):
            text = page_texts[page_num - 1] if page_num - 1 < len(page_texts) else ""
            embedded_images = pdf_to_embedded_images(page, pdf)

            image_urls = []
        for page_num, page in enumerate(pdf, start=1):
            text = page_texts[page_num - 1] if page_num - 1 < len(page_texts) else ""
            embedded_images = pdf_to_embedded_images(page, pdf)


            page_image_file = pdf_to_image(page, doc.title, page_num)

            image_urls = []
            for img_data in embedded_images:
                image_file = ContentFile(img_data["bytes"], name=img_data["name"])
                s3_path = default_storage.save(f"embedded/{img_data['name']}", image_file)
                image_urls.append(default_storage.url(s3_path))

            Page.objects.create(
                doc=doc,
                page_number=page_num,
                ocr=text if text else None,
                image=page_image_file,            
                embedded_images=image_urls or None  
            )

        pdf.close()


        return Response({
            "docId": doc.id,
            "docTitle": doc.title,
        }, status=status.HTTP_201_CREATED)

class DocDetailView(generics.RetrieveAPIView):
    queryset = Doc.objects.all()
    def get(self, request, docId):
        doc = Doc.objects.get(id=docId)
        pages = doc.pages.all()
        role = getattr(request.user, "role", None)

        data = []

        if role == 'assistant':
            data = [
                {
                    "docId": doc.id,
                    "pageNumber": p.page_number,
                    "image": p.image.url if p.image else None
                }
                for p in pages
            ]

        elif role == 'student':
            for p in pages:
                page_data = {
                    "docId": doc.id,
                    "pageNumber": p.page_number,
                }

                if p.ocr and not p.embedded_images:
                    page_data["ocr"] = p.ocr


                elif p.ocr and p.embedded_images:
                    page_data["ocr"] = p.ocr
                    page_data["embedded_images"] = p.embedded_images

                elif not p.ocr and p.image:
                    page_data["image"] = p.image.url

                data.append(page_data)

        return Response({
            "docId": doc.id,
            "title": doc.title,
            "pages": data
        }, status=status.HTTP_200_OK)
    
    def patch(self, request, docId):
            doc = self.get_queryset().get(id=docId)
            new_title = request.data.get("title")
            doc.title = new_title
            doc.save()
            return Response({"docId": doc.id, "title": doc.title}, status=200)

    def delete(self, request, docId):
        doc = self.get_queryset().get(id=docId)
        doc.delete()
        return Response({"message": "파일이 삭제되었습니다."}, status=204)
