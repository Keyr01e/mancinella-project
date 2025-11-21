# Этап сборки
FROM node:20-alpine AS build

WORKDIR /app

# Копируем package.json отдельно, чтобы кэшировалось
COPY package.json package-lock.json* ./

RUN npm install

# Копируем весь проект
COPY . .

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
