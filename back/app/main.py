from fastapi import FastAPI
from app.api.v1.routes import api_router
from app.core.database import Base, engine # Импортируем для создания таблиц
from app.api.v1.endpoints import websocket
# Создаем все таблицы в базе данных (если они еще не созданы)
Base.metadata.create_all(bind=engine)
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="FastAPI Messenger",
    description="A messenger application built with FastAPI",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # или список твоих доменов
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(websocket.router, prefix="/ws")
@app.get("/")
async def root():
    return {"message": "Welcome to FastAPI Messenger"}