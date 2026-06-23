// Config compartilhada das métricas da linha do tempo (gráfico + cards de análise)
export const METRICAS = [
  { key: 'caixa',   label: 'Caixa',       cor: '#0D2B55', tipo: 'moeda', bomQuando: 'subir', get: (r) => Number(r.caixa || 0) },
  { key: 'receber', label: 'A receber',   cor: '#639922', tipo: 'moeda', bomQuando: null,    get: (r) => Number(r.a_receber || 0) },
  { key: 'pagar',   label: 'A pagar',     cor: '#D85A30', tipo: 'moeda', bomQuando: null,    get: (r) => Number(r.a_pagar || 0) },
  { key: 'inad',    label: '% em atraso', cor: '#A32D2D', tipo: 'pct',   bomQuando: 'cair',  get: (r) => (Number(r.a_receber) > 0 ? (Number(r.a_receber_atraso) / Number(r.a_receber)) * 100 : 0) },
]

export function getMetrica(key) {
  return METRICAS.find((m) => m.key === key) || METRICAS[0]
}
