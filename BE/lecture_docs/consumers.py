from channels.generic.websocket import AsyncJsonWebsocketConsumer
from urllib.parse import parse_qs
from rest_framework_simplejwt.tokens import UntypedToken
from jwt import decode as jwt_decode
from django.conf import settings
from django.contrib.auth import get_user_model
from asgiref.sync import sync_to_async

User = get_user_model()

async def user_from_token(token):
        UntypedToken(token)

        data = jwt_decode(
            token,
            settings.SECRET_KEY,     
            algorithms=["HS256"],    
        )

        user_id = data.get("user_id")

        user = await sync_to_async(User.objects.get)(id=user_id)
        return user


class DocSync(AsyncJsonWebsocketConsumer):

    async def connect(self):
        query = parse_qs(self.scope["query_string"].decode())
        token = query.get("token", [None])[0]

        self.user = await user_from_token(token)

        if not self.user:
            await self.close()
            return

        self.doc_id = self.scope["url_route"]["kwargs"]["doc_id"]
        self.group_name = f"doc_{self.doc_id}"

        self.sync_enabled = False

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content):
        msg_type = content.get("type")

        #소켓 on/off
        if msg_type == "TOGGLE_SYNC":
            enabled = bool(content.get("enabled", True))
            self.sync_enabled = enabled

            await self.send_json({
                "type": "SYNC_STATUS",
                "enabled": self.sync_enabled,
            })

            if self.user.role == "student" and self.sync_enabled:
                await self.send_json({
                    "type": "FORCE_MOVE_REQUEST"
                })

            return

        #페이지 이동
        if msg_type == "PAGE_CHANGE":
            page = content.get("page")
            if page is None:
                return

            if self.user.role != "assistant":
                return
            
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "page_change",
                    "page": page,
                },
            )
            return
        
        #판서
        if msg_type == "BOARD_EVENT":
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "board_event",
                    "event": content.get("event"),
                    "data": content.get("data", {}),
                },
            )
            return
        
    async def page_change(self, event):
        page = event["page"]

        if self.user.role == "student" and not self.sync_enabled:
            return

        await self.send_json({
            "type": "PAGE_CHANGE",
            "page": page,
        })


    async def board_event(self, event):
        await self.send_json({
            "type": "BOARD_EVENT",
            "event": event["event"],
            "data": event["data"],
        })