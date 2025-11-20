from sqlalchemy.orm import Session
from app.models.chat import Message, ChatRoom
from app.schemas.chat import MessageCreate, ChatRoomCreate

def get_messages(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Message).offset(skip).limit(limit).all()

def create_message(db: Session, message: MessageCreate, sender_id: int):
    db_message = Message(**message.model_dump(), sender_id=sender_id)
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_chat_room(db: Session, chat_room_id: int):
    return db.query(ChatRoom).filter(ChatRoom.id == chat_room_id).first()

def create_chat_room(db: Session, chat_room: ChatRoomCreate, creator_id: int = None):
    db_chat_room = ChatRoom(**chat_room.model_dump(), creator_id=creator_id)
    db.add(db_chat_room)
    db.commit()
    db.refresh(db_chat_room)
    return db_chat_room

def get_messages_for_chat_room(db: Session, chat_room_id: int, skip: int = 0, limit: int = 100):
    return db.query(Message).filter(Message.chat_room_id == chat_room_id).offset(skip).limit(limit).all()