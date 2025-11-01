from channels.generic.websocket import AsyncJsonWebsocketConsumer
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from jwt import decode as jwt_decode
from django.conf import settings
from django.contrib.auth import get_user_model
from asgiref.sync import sync_to_async
from .models import Doc  

User = get_user_model()

def user_from_token(token):
    try:
        UntypedToken(token)  
        payload = jwt_decode(
            token,
            settings.SIMPLE_JWT["SIGNING_KEY"],
            algorithms=[settings.SIMPLE_JWT["ALGORITHM"]],
        )
        user_id = payload.get("user_id")
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist):
        return None

class DocSync(AsyncJsonWebsocketConsumer):
    async def connect(self):
        #같은 교안 보고있는 사람끼리 묶음
        self.doc_id = self.scope["url_route"]["kwargs"]["doc_id"]
        self.group_name = f"doc_{self.doc_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print(f"Connected to doc {self.doc_id}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
    
    #프론트에서 요청을 받을때
    async def receive_json(self, content):

        msg_type = content.get("type")
        if msg_type == "PAGE_CHANGE":
            page = content.get("page")

            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "group.page_change",
                    "page": page,
                },
            )
    #이벤트처리
    async def group_page_change(self, event):
        await self.send_json({
            "type": "PAGE_CHANGE",
            "page": event["page"],
        })
