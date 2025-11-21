# ---------- STAGE 1 — Build ----------
FROM node:18-alpine AS build

WORKDIR /app

# Только package.json сначала — чтобы кеш работал
COPY package*.json ./

RUN npm install

# Теперь весь код
COPY . .

# Сборка production
RUN npm run build


# ---------- STAGE 2 — Nginx ----------
FROM nginx:alpine

# Удаляем дефолтную страницу nginx
RUN rm -rf /usr/share/nginx/html/*

# Копируем сборку из предыдущего слоя
COPY --from=build /app/dist /usr/share/nginx/html

# Открываем 80 порт
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
