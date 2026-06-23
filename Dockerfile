# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# Estágio 1 — build do app Vite
# As variáveis VITE_* NÃO são necessárias aqui: elas são injetadas em RUNTIME
# (ver docker-entrypoint.d/40-config.sh, que gera /config.js na subida do
# container). Isso evita o problema de variáveis "assadas" no build.
# ----------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ----------------------------------------------------------------------------
# Estágio 2 — servir o build com nginx + proxy reverso para a Omie
# ----------------------------------------------------------------------------
FROM nginx:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Script que gera /config.js a partir das variáveis de ambiente do container.
# A imagem oficial do nginx roda /docker-entrypoint.d/*.sh antes de subir.
COPY docker-entrypoint.d/40-config.sh /docker-entrypoint.d/40-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-config.sh \
    && chmod +x /docker-entrypoint.d/40-config.sh

EXPOSE 80
# ENTRYPOINT/CMD herdados da imagem nginx: rodam os scripts de /docker-entrypoint.d
# e em seguida iniciam o nginx em foreground.
