# syntax=docker/dockerfile:1

# ----------------------------------------------------------------------------
# Estágio 1 — build do app Vite
# As variáveis VITE_* são "assadas" no bundle em tempo de BUILD, por isso
# chegam como build args (no EasyPanel: defina-as como Environment Variables;
# elas são repassadas como --build-arg automaticamente).
# ----------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_APP_KEY_OMIE
ARG VITE_APP_SECRET_OMIE
ARG VITE_APP_KEY_OMIE_MEDIMAGEM
ARG VITE_APP_SECRET_OMIE_MEDIMAGEM
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_APP_KEY_OMIE=$VITE_APP_KEY_OMIE \
    VITE_APP_SECRET_OMIE=$VITE_APP_SECRET_OMIE \
    VITE_APP_KEY_OMIE_MEDIMAGEM=$VITE_APP_KEY_OMIE_MEDIMAGEM \
    VITE_APP_SECRET_OMIE_MEDIMAGEM=$VITE_APP_SECRET_OMIE_MEDIMAGEM \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ----------------------------------------------------------------------------
# Estágio 2 — servir o build estático com nginx + proxy reverso para a Omie
# (substitui o proxy de desenvolvimento do Vite, que não existe em produção)
# ----------------------------------------------------------------------------
FROM nginx:alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
