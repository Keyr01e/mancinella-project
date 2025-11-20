from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    avatar = Column(String, nullable=True)  # URL или путь к файлу аватара

    sent_messages = relationship(
        "Message",
        foreign_keys="Message.sender_id",
        back_populates="sender",
        lazy="joined"
    )
    received_messages = relationship(
        "Message",
        foreign_keys="Message.receiver_id",
        back_populates="receiver",
        lazy="joined"
    )
