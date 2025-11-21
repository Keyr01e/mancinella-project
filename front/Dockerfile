# Этап сборки
FROM node:20-alpine AS build

WORKDIR /app

# Копируем package.json отдельно, чтобы кэшировалось
COPY package.json package-lock.json* ./

RUN npm install

# Копируем весь проект
COPY . .

# Пробрасываем переменные окружения для Vite на этапе сборки
ARG VITE_API_URL
ARG VITE_WS_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# Сборка
RUN npm run build

# Этап production — nginx
FROM nginx:stable-alpine

# Удаляем дефолтную страницу nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем сборку
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
