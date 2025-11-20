from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any

class MessageBase(BaseModel):
    content: str

class MessageCreate(MessageBase):
    receiver_id: Optional[int] = None
    chat_room_id: Optional[int] = None
    attachments: Optional[List[Dict[str, Any]]] = None

class Message(MessageBase):
    id: int
    sender_id: int
    sender_name: Optional[str] = None
    timestamp: datetime
    receiver_id: Optional[int] = None
    chat_room_id: Optional[int] = None
    attachments: Optional[List[Dict[str, Any]]] = None

    class Config:
        from_attributes = True

class ChatRoomBase(BaseModel):
    name: str

class ChatRoomCreate(ChatRoomBase):
    description: Optional[str] = None

class ChatRoom(ChatRoomBase):
    id: int
    creator_id: Optional[int] = None
    messages: list[Message] = []

    class Config:
        from_attributes = True