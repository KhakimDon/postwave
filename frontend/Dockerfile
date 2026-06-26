# --- build stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Прод-фронт ходит на тот же домен через nginx → относительный /api.
# Удаляем .env.production (он указывает на ngrok), чтобы не перебил VITE_API_BASE.
RUN rm -f .env.production
ENV VITE_API_BASE=/api
RUN npm run build

# --- serve stage ---
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
