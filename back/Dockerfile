# ./back/Dockerfile
FROM python:3.12-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код
COPY . .

# Указываем порт, который будет доступен снаружи
EXPOSE 8000

# Команда для запуска (замени на свою, если используешь другой сервер)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

