from django.shortcuts import render
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Lecture
from .serializers import LectureSerializer, LectureUpdateSerializer, LectureCreateSerializer

class LectureView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """강의 목록 조회"""
        user = request.user
        if user.role == "assistant":
            lectures = Lecture.objects.filter(assistant=user)
        elif user.role == "student":
            lectures = Lecture.objects.filter(student=user)
        else:
            lectures = Lecture.objects.none()

        serializer = LectureSerializer(lectures, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """강의 생성"""
        serializer = LectureCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        lecture = serializer.save()
        
        return Response({
            "title": lecture.title,
            "lecture_id": lecture.id,
            "code": lecture.code,
        }, status=status.HTTP_201_CREATED)

class LectureDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, lectureId):
        try:
            return Lecture.objects.get(id=lectureId)
        except Lecture.DoesNotExist:
            return None
        
    def get(self, request, lectureId):
        """강의 상세 조회"""
        lecture = self.get_object(lectureId)
        if not lecture:
            return Response({"error": "해당 강의를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        serializer = LectureSerializer(lecture)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, lectureId):
        """강의 이름 수정"""
        lecture = self.get_object(lectureId)
        if not lecture:
            return Response({"error": "해당 강의를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if lecture.student != user and lecture.assistant != user:
            return Response({"error": "본인이 만든 강의만 수정할 수 있습니다."},
                            status=status.HTTP_403_FORBIDDEN)

        serializer = LectureUpdateSerializer(lecture, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            "lecture_id": lecture.id,
            "title": lecture.title
        }, status=status.HTTP_200_OK)
    
    def delete(self, request, lectureId):
        """강의 삭제"""
        lecture = self.get_object(lectureId)
        if not lecture:
            return Response({"error": "해당 강의를 찾을 수 없습니다."}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if lecture.student != user and lecture.assistant != user:
            return Response({"error": "본인이 만든 강의만 삭제할 수 있습니다."},
                            status=status.HTTP_403_FORBIDDEN)

        lecture.delete()
        return Response({"message": "강의 폴더가 삭제되었습니다."}, status=status.HTTP_204_NO_CONTENT)
    
class LectureJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self, lectureId):
        try:
            return Lecture.objects.get(id=lectureId)
        except Lecture.DoesNotExist:
            return None

    def post(self, request):
        """강의코드 입력 → 강의 연결"""
        code = request.data.get("code")
        user = request.user

        try:
            lecture = Lecture.objects.get(code=code)
        except Lecture.DoesNotExist:
            return Response({"error": "유효하지 않은 강의 코드입니다."}, status=status.HTTP_404_NOT_FOUND)

        # ✅ 이미 다른 도우미가 연결돼 있을 경우 예외 처리
        if user.role == "assistant":
            if lecture.assistant and lecture.assistant != user:
                return Response(
                    {"error": "이미 다른 학습도우미가 참여 중인 강의입니다."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ✅ 도우미 정보 등록
            lecture.assistant = user
            lecture.save(update_fields=['assistant'])

        elif user.role == "student":
            if lecture.student and lecture.student != user:
                return Response(
                    {"error": "이미 다른 학생이 참여 중인 강의입니다."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # ✅ 학생 정보 등록
            lecture.student = user
            lecture.save(update_fields=['student'])

        return Response({
            "lecture_id": lecture.id,
            "title": lecture.title,
            "role": user.role
        }, status=status.HTTP_200_OK)