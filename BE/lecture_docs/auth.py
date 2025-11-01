from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

def user_from_token(token):
    try:
        UntypedToken(token)
        payload = jwt_decode(token, settings.SIMPLE_JWT["SIGNING_KEY"], algorithms=[settings.SIMPLE_JWT["ALGORITHM"]])
        user_id = payload.get("user_id")
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist):
        return None
