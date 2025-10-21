from django.shortcuts import render
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from app.models import Lecture
from .serializers import LectureSerializer, LectureCreateSerializer, LectureUpdateSerializer

# ① 강의폴더 생성
class LectureCreateView(generics.CreateAPIView):
    queryset = Lecture.objects.all()
    serializer_class = LectureCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        lecture = serializer.save()
        return Response({
            "message": "강의폴더 생성 완료",
            "lecture_id": lecture.id,
            "lecture_code": lecture.code,
        }, status=status.HTTP_201_CREATED)
    
# ① 강의폴더 이름 수정
class LectureUpdateView(generics.UpdateAPIView):
    queryset = Lecture.objects.all()
    serializer_class = LectureUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, *args, **kwargs):
        lecture = self.get_object()
        user = request.user

        # ✅ 본인이 만든 강의만 수정 가능
        if lecture.student != user and lecture.assistant != user:
            return Response({"error": "본인이 만든 강의만 수정할 수 있습니다."},
                            status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(lecture, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "message": "강의폴더 이름이 수정되었습니다.",
            "lecture_id": lecture.id,
            "new_title": lecture.title
        }, status=status.HTTP_200_OK)


# ② 강의코드 입력 → 강의 상세조회
class LectureJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        code = request.data.get("code")
        user = request.user

        try:
            lecture = Lecture.objects.get(code=code)

            # ✅ 학습도우미만 코드로 접근 가능
            if user.role != 'assistant':
                return Response(
                    {"error": "강의코드로 접근할 수 있는 권한이 없습니다."},
                    status=status.HTTP_403_FORBIDDEN
                )

            # ✅ 이미 다른 도우미가 연결돼 있을 경우 예외 처리
            if lecture.assistant and lecture.assistant != user:
                return Response(
                    {"error": "이미 다른 학습도우미가 참여 중인 강의입니다."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ✅ 도우미 정보 등록
            if lecture.assistant != user:
                lecture.assistant = user
                lecture.save()

            serializer = LectureSerializer(lecture)
            return Response({
                "message": "강의코드 일치 및 도우미 등록 완료",
                "lecture": serializer.data
            }, status=status.HTTP_200_OK)

        except Lecture.DoesNotExist:
            return Response({"error": "유효하지 않은 코드입니다."}, status=status.HTTP_404_NOT_FOUND)


# ③ 폴더 리스트 조회
class LectureListView(generics.ListAPIView):
    serializer_class = LectureSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == 'assistant':
            return Lecture.objects.filter(assistant=user)
        elif user.role == 'student':
            return Lecture.objects.filter(student=user)
        return Lecture.objects.none()