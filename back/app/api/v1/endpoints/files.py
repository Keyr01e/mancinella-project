from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.v1.endpoints.users import get_current_user
from app.models.user import User
import os
import uuid
from pathlib import Path

router = APIRouter()

# ВАЖНО: Используем абсолютный путь, который мы подключим через Docker Volume
UPLOAD_DIR = Path("/app/media")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

AVATAR_DIR = UPLOAD_DIR / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

ATTACHMENTS_DIR = UPLOAD_DIR / "attachments"
ATTACHMENTS_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_files(
    files: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Загрузка файлов (вложения к сообщениям)"""
    uploaded_files = []
    
    for file in files:
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = ATTACHMENTS_DIR / unique_filename
        
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # ИЗМЕНЕНИЕ: Формируем URL для Nginx (/media/...)
        file_url = f"/media/attachments/{unique_filename}"
        
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
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Удаляем старый аватар (если он локальный)
    if current_user.avatar and current_user.avatar.startswith("/media/"):
        try:
            # Превращаем URL /media/avatars/file.jpg обратно в путь /app/media/avatars/file.jpg
            old_filename = os.path.basename(current_user.avatar)
            old_file_path = AVATAR_DIR / old_filename
            if old_file_path.exists():
                old_file_path.unlink()
        except Exception as e:
            print(f"Error deleting old avatar: {e}")

    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{current_user.id}_{uuid.uuid4()}{file_extension}"
    file_path = AVATAR_DIR / unique_filename
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # ИЗМЕНЕНИЕ: URL для Nginx
    avatar_url = f"/media/avatars/{unique_filename}"
    
    current_user.avatar = avatar_url
    db.commit()
    db.refresh(current_user)
    
    return {"avatar_url": avatar_url}

# Эндпоинты GET удалены, так как файлы теперь отдает Nginx
