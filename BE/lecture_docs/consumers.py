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
        data = jwt_decode(
            token,
            settings.SIMPLE_JWT["SIGNING_KEY"],
            algorithms=[settings.SIMPLE_JWT["ALGORITHM"]],
        )
        user_id = data.get("user_id")
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist):
        return None

class DocSync(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.doc_id = self.scope["url_route"]["kwargs"]["doc_id"]
        self.group_name = f"doc_{self.doc_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

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

        elif msg_type == "BOARD_EVENT":
            event = content.get("event")  
            data = content.get("data", {})
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "group.board_event",
                    "event": event,
                    "data": data,
                },
            )

    async def page_change(self, event):
        await self.send_json({
            "type": "PAGE_CHANGE",
            "page": event["page"],
        })

    async def board_event(self, event):
        await self.send_json({
            "type": "BOARD_EVENT",
            "event": event["event"],
            "data": event["data"],
        })