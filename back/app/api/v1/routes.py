from fastapi import APIRouter
from app.api.v1.endpoints import users, chats, websocket, files

api_router = APIRouter()

api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(chats.router, prefix="/chats", tags=["chats"])
api_router.include_router(websocket.router, prefix="/ws", tags=["websocket"])
api_router.include_router(files.router, prefix="/files", tags=["files"])