import os
import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "project.settings")

# ✅ Django 초기화 먼저
django.setup()

# ✅ setup 후에 consumer import
from lecture_docs.consumers import DocSync

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter([
            path("ws/doc/<int:doc_id>/", DocSync.as_asgi()),
        ])
    ),
})
