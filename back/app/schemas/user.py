from pydantic import BaseModel
from typing import Optional

class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: int
    is_active: bool
    avatar: Optional[str] = None

    class Config:
        from_attributes = True

class User(UserInDB):
    pass