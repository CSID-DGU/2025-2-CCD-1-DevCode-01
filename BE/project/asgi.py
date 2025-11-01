import os, django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path
from lecture_docs.consumers import DocSync

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "project.settings")
django.setup()

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter([
            path("ws/doc/<int:doc_id>/", DocSync.as_asgi()),
        ])
    ),
})
