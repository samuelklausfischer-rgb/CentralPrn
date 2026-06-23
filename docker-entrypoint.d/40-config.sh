#!/bin/sh
set -e

# Gera /config.js a partir das variáveis de ambiente do container.
# A imagem oficial do nginx executa automaticamente todos os
# /docker-entrypoint.d/*.sh (executáveis) ANTES de iniciar o nginx.
# Assim as variáveis chegam em RUNTIME — não dependem do build.

CONFIG_PATH="/usr/share/nginx/html/config.js"

cat > "$CONFIG_PATH" <<EOF
window.__ENV__ = {
  VITE_APP_KEY_OMIE: "${VITE_APP_KEY_OMIE:-}",
  VITE_APP_SECRET_OMIE: "${VITE_APP_SECRET_OMIE:-}",
  VITE_APP_KEY_OMIE_MEDIMAGEM: "${VITE_APP_KEY_OMIE_MEDIMAGEM:-}",
  VITE_APP_SECRET_OMIE_MEDIMAGEM: "${VITE_APP_SECRET_OMIE_MEDIMAGEM:-}",
  VITE_SUPABASE_URL: "${VITE_SUPABASE_URL:-}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY:-}"
};
EOF

# Log diagnóstico (sem expor valores): conta quantas variáveis vieram preenchidas.
PREENCHIDAS=$(grep -oE '"[^"]+"' "$CONFIG_PATH" | grep -vcE '""' || true)
echo "[40-config] /config.js gerado — $PREENCHIDAS variável(is) preenchida(s) de 6."
