// Acesso unificado às variáveis de ambiente.
//
// Em PRODUÇÃO: o container gera /config.js na subida (ver docker-entrypoint.d/40-config.sh)
// preenchendo window.__ENV__ com os valores reais — injetados em RUNTIME pelo EasyPanel.
// Isso evita o problema de variáveis Vite "assadas" no build (build-arg/cache).
//
// Em DESENVOLVIMENTO: window.__ENV__ fica vazio e caímos no import.meta.env (.env.local).
const runtime = (typeof window !== 'undefined' && window.__ENV__) || {}

export function env(key) {
  const v = runtime[key]
  if (v !== undefined && v !== '') return v
  return import.meta.env[key]
}
