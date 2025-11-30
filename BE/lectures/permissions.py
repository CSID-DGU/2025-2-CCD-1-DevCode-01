from rest_framework import permissions

class IsLectureMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user

        lecture = getattr(obj, "lecture", obj)

        return (
            user == lecture.student or
            user == lecture.assistant
        )
