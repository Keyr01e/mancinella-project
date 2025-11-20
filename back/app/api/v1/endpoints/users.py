from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.crud import user as crud_user
from app.schemas import user as schemas_user
from app.schemas import token as schemas_token
from app.core import security
from datetime import timedelta
from app.core.config import settings
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/users/token")

router = APIRouter()

@router.post("/register", response_model=schemas_user.User)
def register_user(user: schemas_user.UserCreate, db: Session = Depends(get_db)):
    db_user = crud_user.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return crud_user.create_user(db=db, user=user)

@router.post("/token", response_model=schemas_token.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud_user.get_user_by_username(db, username=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", 'user_id': user.id, 'username': user.username}


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = security.decode_access_token(token)
    if payload is None:
        print("DEBUG: Token decode failed or returned None")
        raise credentials_exception
    username: str = payload.get("sub")
    if username is None:
        print("DEBUG: No 'sub' in token payload")
        raise credentials_exception
    user = crud_user.get_user_by_username(db, username=username)
    if user is None:
        print(f"DEBUG: User '{username}' not found in DB")
        raise credentials_exception
    print(f"DEBUG: Successfully authenticated user: {user.username}")
    return user


@router.get("/me", response_model=schemas_user.User)
async def get_me(current_user = Depends(get_current_user)):
    """Получить информацию о текущем пользователе"""
    return current_user


@router.get("/{user_id}", response_model=schemas_user.User)
async def get_user(user_id: int, db: Session = Depends(get_db)):
    """Получить информацию о пользователе по ID"""
    user = crud_user.get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user