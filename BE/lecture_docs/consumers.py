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
    #웹소켓 on/off
    async def connect(self):
        query = parse_qs(self.scope["query_string"].decode())
        token = query.get("token", [None])[0]

        self.user = await user_from_token(token)

        self.doc_id = self.scope["url_route"]["kwargs"]["doc_id"]
        self.group_name = f"doc_{self.doc_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        if self.user.role == "student":
            await self.send_json({
                "type": "FORCE_MOVE_REQUEST"
            })


    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)


    async def receive_json(self, content):
        msg_type = content.get("type")

        if msg_type == "FORCE_MOVE":
            page = content.get("page")
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "force_move",
                    "page": page,
                },
            )
            return

        if msg_type == "PAGE_CHANGE":

            if self.user.role != "assistant":
                return

            page = content.get("page")
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "page_change",
                    "page": page,
                },
            )
            return

        if msg_type == "BOARD_EVENT":
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "board_event",
                    "event": content.get("event"),
                    "data": content.get("data", {}),
                },
            )

    async def page_change(self, event):
        await self.send_json({
            "type": "PAGE_CHANGE",
            "page": event["page"],
        })

    async def force_move(self, event):
        await self.send_json({
            "type": "FORCE_MOVE",
            "page": event["page"],
        })

    async def board_event(self, event):
        await self.send_json({
            "type": "BOARD_EVENT",
            "event": event["event"],
            "data": event["data"],
        })
