from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.crud import chat as crud_chat
from app.schemas import chat as schemas_chat
from app.api.v1.endpoints.users import get_current_user
from app.models.user import User
from app.models import chat as models_chat
from app.api.v1.endpoints.websocket import manager
import json

router = APIRouter()


@router.post("/messages", response_model=schemas_chat.Message)
async def send_message(
        message: schemas_chat.MessageCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    if not message.receiver_id and not message.chat_room_id:
        raise HTTPException(status_code=400, detail="Message must have a receiver or a chat room.")

    if message.chat_room_id:
        chat_room = crud_chat.get_chat_room(db, message.chat_room_id)
        if not chat_room:
            raise HTTPException(status_code=404, detail="Chat room not found.")

    # Создаём сообщение в БД
    db_message = crud_chat.create_message(db=db, message=message, sender_id=current_user.id)
    
    # Отправляем сообщение через WebSocket всем подключённым пользователям
    ws_payload = {
        "type": "message",
        "data": {
            "id": db_message.id,
            "content": db_message.content,
            "sender_id": db_message.sender_id,
            "sender_name": current_user.username if hasattr(current_user, 'username') else f"User {current_user.id}",
            "receiver_id": db_message.receiver_id,
            "chat_room_id": db_message.chat_room_id,
            "timestamp": db_message.timestamp.isoformat() if db_message.timestamp else None,
            "attachments": db_message.attachments if db_message.attachments else []
        }
    }
    
    print(f"📤 Broadcasting message via WebSocket: {ws_payload}")
    await manager.broadcast(json.dumps(ws_payload))
    
    return db_message


@router.get("/messages", response_model=list[schemas_chat.Message])
def get_all_messages(
        skip: int = 0, limit: int = 100,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    messages = db.query(models_chat.Message).filter(
        (models_chat.Message.sender_id == current_user.id) |
        (models_chat.Message.receiver_id == current_user.id)
    ).offset(skip).limit(limit).all()
    
    # Добавляем sender_name к каждому сообщению
    result = []
    for msg in messages:
        msg_dict = {
            "id": msg.id,
            "content": msg.content,
            "sender_id": msg.sender_id,
            "sender_name": msg.sender.username if msg.sender else f"User {msg.sender_id}",
            "receiver_id": msg.receiver_id,
            "chat_room_id": msg.chat_room_id,
            "timestamp": msg.timestamp,
            "attachments": msg.attachments if msg.attachments else []
        }
        result.append(msg_dict)
    
    return result


@router.post("/chat_rooms", response_model=schemas_chat.ChatRoom)
def create_chat_room(
        chat_room: schemas_chat.ChatRoomCreate,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    db_chat_room = crud_chat.create_chat_room(db=db, chat_room=chat_room, creator_id=current_user.id)
    return db_chat_room


@router.get("/chat_rooms/{chat_room_id}/messages", response_model=list[schemas_chat.Message])
def get_chat_room_messages(
        chat_room_id: int,
        skip: int = 0, limit: int = 100,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    chat_room = crud_chat.get_chat_room(db, chat_room_id)
    if not chat_room:
        raise HTTPException(status_code=404, detail="Chat room not found.")

    # Здесь можно добавить проверку, состоит ли пользователь в этом чате
    messages = crud_chat.get_messages_for_chat_room(db, chat_room_id, skip=skip, limit=limit)
    
    # Добавляем sender_name к каждому сообщению
    result = []
    for msg in messages:
        msg_dict = {
            "id": msg.id,
            "content": msg.content,
            "sender_id": msg.sender_id,
            "sender_name": msg.sender.username if msg.sender else f"User {msg.sender_id}",
            "receiver_id": msg.receiver_id,
            "chat_room_id": msg.chat_room_id,
            "timestamp": msg.timestamp,
            "attachments": msg.attachments if msg.attachments else []
        }
        result.append(msg_dict)
    
    return result


@router.get("/chat_rooms", response_model=list[schemas_chat.ChatRoom])
def get_chat_rooms(db: Session = Depends(get_db)):
    return db.query(models_chat.ChatRoom).all()


@router.delete("/messages/{message_id}")
async def delete_message(
        message_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    message = db.query(models_chat.Message).filter(models_chat.Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Проверяем, что пользователь - автор сообщения
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can delete this message")
    
    chat_room_id = message.chat_room_id
    db.delete(message)
    db.commit()
    
    # Отправляем уведомление через WebSocket о удалении сообщения
    ws_payload = {
        "type": "message_deleted",
        "data": {
            "message_id": message_id,
            "chat_room_id": chat_room_id
        }
    }
    await manager.broadcast(json.dumps(ws_payload))
    
    return {"message": "Message deleted successfully"}


@router.delete("/chat_rooms/{chat_room_id}")
def delete_chat_room(
        chat_room_id: int,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
):
    chat_room = crud_chat.get_chat_room(db, chat_room_id)
    if not chat_room:
        raise HTTPException(status_code=404, detail="Chat room not found")
    
    # Проверяем, что пользователь - создатель комнаты
    if chat_room.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can delete this room")
    
    db.delete(chat_room)
    db.commit()
    return {"message": "Chat room deleted successfully"}
