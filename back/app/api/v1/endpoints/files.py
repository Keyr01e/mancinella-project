from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.endpoints.users import get_current_user
from app.models.user import User
import os
import uuid
from pathlib import Path

router = APIRouter()

# Директория для хранения файлов
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

AVATAR_DIR = UPLOAD_DIR / "avatars"
AVATAR_DIR.mkdir(exist_ok=True)

ATTACHMENTS_DIR = UPLOAD_DIR / "attachments"
ATTACHMENTS_DIR.mkdir(exist_ok=True)


@router.post("/upload")
async def upload_files(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Загрузка файлов (вложения к сообщениям)"""
    uploaded_files = []
    
    for file in files:
        # Генерируем уникальное имя файла
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = ATTACHMENTS_DIR / unique_filename
        
        # Сохраняем файл
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Формируем URL для доступа к файлу
        file_url = f"/api/v1/files/attachments/{unique_filename}"
        
        uploaded_files.append({
            "name": file.filename,
            "url": file_url,
            "size": len(content),
            "type": file.content_type
        })
    
    return {"files": uploaded_files}


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Загрузка аватара пользователя"""
    # Проверяем тип файла
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Удаляем старый аватар если есть
    if current_user.avatar:
        old_avatar_path = AVATAR_DIR / os.path.basename(current_user.avatar)
        if old_avatar_path.exists():
            old_avatar_path.unlink()
    
    # Генерируем уникальное имя файла
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{current_user.id}_{uuid.uuid4()}{file_extension}"
    file_path = AVATAR_DIR / unique_filename
    
    # Сохраняем файл
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Обновляем URL аватара в БД
    avatar_url = f"/api/v1/files/avatars/{unique_filename}"
    current_user.avatar = avatar_url
    db.commit()
    db.refresh(current_user)
    
    return {"avatar_url": avatar_url}


@router.get("/avatars/{filename}")
async def get_avatar(filename: str):
    """Получение файла аватара"""
    from fastapi.responses import FileResponse
    file_path = AVATAR_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Avatar not found")
    return FileResponse(file_path)


@router.get("/attachments/{filename}")
async def get_attachment(filename: str):
    """Получение файла вложения"""
    from fastapi.responses import FileResponse
    file_path = ATTACHMENTS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)
