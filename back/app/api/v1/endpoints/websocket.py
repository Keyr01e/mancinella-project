from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json

router = APIRouter()

# ==========================
#  Менеджер подключений
# ==========================
class ConnectionManager:
    def __init__(self):
        # Изменено: теперь поддерживаем множественные подключения от одного пользователя
        # {user_id: [websocket1, websocket2, ...]}
        self.active_connections = {}
        # Отслеживание пользователей в голосовых каналах
        # {channel_name: [user_id1, user_id2, ...]}
        self.voice_channels = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        print(f"✅ User {user_id} connected (total connections: {len(self.active_connections[user_id])})")

    def disconnect(self, websocket: WebSocket, user_id: int):
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].remove(websocket)
                print(f"❌ User {user_id} disconnected (remaining connections: {len(self.active_connections[user_id])})")
                # Удаляем пользователя из словаря, если у него больше нет подключений
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
            except ValueError:
                pass

    async def send_personal_message(self, message: str, user_id: int):
        """Отправляет сообщение всем подключениям конкретного пользователя"""
        if user_id in self.active_connections:
            disconnected = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(message)
                except Exception as e:
                    print(f"Failed to send to user {user_id}: {e}")
                    disconnected.append(ws)
            
            # Удаляем отключенные websocket'ы
            for ws in disconnected:
                try:
                    self.active_connections[user_id].remove(ws)
                except ValueError:
                    pass

    async def broadcast(self, message: str):
        """Отправляет сообщение всем подключениям всех пользователей"""
        disconnected = []
        for user_id, websockets in self.active_connections.items():
            for ws in websockets:
                try:
                    await ws.send_text(message)
                except Exception as e:
                    print(f"Failed to broadcast to user {user_id}: {e}")
                    disconnected.append((user_id, ws))
        
        # Удаляем отключенные websocket'ы
        for user_id, ws in disconnected:
            try:
                self.active_connections[user_id].remove(ws)
            except (ValueError, KeyError):
                pass
    
    def join_voice_channel(self, user_id: int, channel_name: str):
        """Добавляет пользователя в голосовой канал"""
        if channel_name not in self.voice_channels:
            self.voice_channels[channel_name] = []
        if user_id not in self.voice_channels[channel_name]:
            self.voice_channels[channel_name].append(user_id)
            print(f"🎤 User {user_id} joined voice channel '{channel_name}' (total: {len(self.voice_channels[channel_name])})")
    
    def leave_voice_channel(self, user_id: int, channel_name: str):
        """Удаляет пользователя из голосового канала"""
        if channel_name in self.voice_channels:
            if user_id in self.voice_channels[channel_name]:
                self.voice_channels[channel_name].remove(user_id)
                print(f"🎤 User {user_id} left voice channel '{channel_name}' (remaining: {len(self.voice_channels[channel_name])})")
                # Удаляем канал если он пустой
                if not self.voice_channels[channel_name]:
                    del self.voice_channels[channel_name]
    
    def get_voice_channel_users(self, channel_name: str):
        """Возвращает список пользователей в голосовом канале"""
        return self.voice_channels.get(channel_name, [])
    
    def get_all_voice_channels(self):
        """Возвращает все голосовые каналы с пользователями"""
        return dict(self.voice_channels)


manager = ConnectionManager()


# ==========================
#  HTTP эндпоинт для получения списка пользователей в голосовых каналах
# ==========================
@router.get("/voice_channels")
async def get_voice_channels():
    """Возвращает список всех голосовых каналов с подключенными пользователями"""
    return {"voice_channels": manager.get_all_voice_channels()}


# ==========================
#  Основной WebSocket эндпоинт
# ==========================
@router.websocket("/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: int
):
    # Принимаем подключение без дополнительной аутентификации
    # В реальном приложении здесь должна быть проверка токена
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                message_type = payload.get("type")
                receiver_id = payload.get("receiver_id")
                voice_channel_name = payload.get("voice_channel_name")

                # Обработка событий голосовых каналов
                if message_type == "voice_channel_join":
                    channel_name = payload.get("data", {}).get("channel_name")
                    join_user_id = payload.get("data", {}).get("user_id")
                    if channel_name and join_user_id:
                        manager.join_voice_channel(int(join_user_id), channel_name)
                    await manager.broadcast(json.dumps(payload))
                    continue
                
                if message_type == "voice_channel_leave":
                    channel_name = payload.get("data", {}).get("channel_name")
                    leave_user_id = payload.get("data", {}).get("user_id")
                    if channel_name and leave_user_id:
                        manager.leave_voice_channel(int(leave_user_id), channel_name)
                    await manager.broadcast(json.dumps(payload))
                    continue
                
                if message_type == "stop_sharing":
                    await manager.broadcast(json.dumps(payload))
                    continue

                # Forward WebRTC signaling to a specific peer
                if message_type in ("offer", "answer", "candidate") and receiver_id:
                    payload["sender_id"] = user_id
                    await manager.send_personal_message(json.dumps(payload), receiver_id)
                    continue
                
                # Broadcast join signal для голосового канала
                if message_type == "join" and voice_channel_name:
                    payload["sender_id"] = user_id
                    await manager.broadcast(json.dumps(payload))
                    continue

                # Private chat message
                if message_type == "private" and receiver_id:
                    await manager.send_personal_message(
                        json.dumps({
                            "type": "message",
                            "sender_id": user_id,
                            "message": payload.get("message")
                        }),
                        receiver_id
                    )
                    continue

                # Broadcast fallback
                await manager.broadcast(
                    json.dumps({
                        "type": message_type or "message",
                        "sender_id": user_id,
                        "message": payload.get("message") if isinstance(payload, dict) else data
                    })
                )

            except json.JSONDecodeError:
                await manager.broadcast(json.dumps({
                    "type": "message",
                    "sender_id": user_id,
                    "message": data
                }))
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        # Не отправляем broadcast о disconnect, так как пользователь может быть подключен с других устройств
        # await manager.broadcast(json.dumps({
        #     "system": f"User {user_id} disconnected"
        # }))

print('123')