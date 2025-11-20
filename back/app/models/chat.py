from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"))
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    chat_room_id = Column(Integer, ForeignKey("chat_rooms.id"), nullable=True)
    content = Column(String)
    attachments = Column(JSON, nullable=True)  # Хранение информации о вложениях
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")
    chat_room = relationship("ChatRoom", back_populates="messages")


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    messages = relationship("Message", back_populates="chat_room")
    creator = relationship("User", foreign_keys=[creator_id])