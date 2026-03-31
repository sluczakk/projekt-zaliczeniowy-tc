# Budowa frontendu
FROM node:20-bookworm AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Budowa backendu
FROM node:20-bookworm
WORKDIR /app

# narzedzia potrzebne do kompilacji natywnej modulow (sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./

# natywna kompilacja modulu
RUN npm ci --omit=dev --build-from-source

COPY backend/ .
COPY --from=frontend-build /app/dist ./public

RUN mkdir -p /app/database

EXPOSE 3000
CMD ["node", "server.js"]