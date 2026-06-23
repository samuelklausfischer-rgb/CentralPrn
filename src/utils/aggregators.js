import { diasEntre } from './dates.js'

// Soma vDoc por cliente; top N desc
export function agruparPorCliente(titulos, topN = 5) {
  const map = new Map()
  for (const t of titulos || []) {
    const nome = t.cNomeCliente || '—'
    map.set(nome, (map.get(nome) || 0) + Number(t.vDoc || 0))
  }
  const arr = [...map.entries()].map(([nome, valor]) => ({ nome, valor }))
  arr.sort((a, b) => b.valor - a.valor)
  return arr.slice(0, topN)
}

// Soma vDoc por categoria; top N + "Outros"
export function agruparPorCategoria(titulos, topN = 6) {
  const map = new Map()
  for (const t of titulos || []) {
    const cat = t.cDescCateg || 'Sem categoria'
    map.set(cat, (map.get(cat) || 0) + Number(t.vDoc || 0))
  }
  const arr = [...map.entries()].map(([nome, valor]) => ({ nome, valor }))
  arr.sort((a, b) => b.valor - a.valor)
  if (arr.length > topN) {
    const top = arr.slice(0, topN)
    const outros = arr.slice(topN).reduce((s, x) => s + x.valor, 0)
    if (outros > 0) top.push({ nome: 'Outros', valor: outros })
    return top
  }
  return arr
}

const FAIXAS = [
  { label: 'A vencer', min: -Infinity, max: 0 },
  { label: '1–30 dias', min: 1, max: 30 },
  { label: '31–60 dias', min: 31, max: 60 },
  { label: '61–90 dias', min: 61, max: 90 },
  { label: '90+ dias', min: 91, max: Infinity },
]

export function bucketsAging(titulos) {
  const buckets = FAIXAS.map((f) => ({ nome: f.label, valor: 0, qtd: 0 }))
  for (const t of titulos || []) {
    const dias = Number(t.nDiasAtraso || 0)
    const idx = FAIXAS.findIndex((f) => dias >= f.min && dias <= f.max)
    if (idx >= 0) { buckets[idx].valor += Number(t.vDoc || 0); buckets[idx].qtd += 1 }
  }
  return buckets
}

export function calcConcentracao(titulos) {
  const lista = agruparPorCliente(titulos, 9999)
  const total = lista.reduce((s, x) => s + x.valor, 0)
  const top1 = lista[0]?.valor || 0
  const top3 = lista.slice(0, 3).reduce((s, x) => s + x.valor, 0)
  return {
    total,
    pctTop1: total > 0 ? (top1 / total) * 100 : 0,
    pctTop3: total > 0 ? (top3 / total) * 100 : 0,
    top1Nome: lista[0]?.nome || '—',
    top1Valor: top1,
  }
}

// Fôlego: dias até o primeiro saldo projetado negativo no fluxoCaixa
export function calcFolego(fluxo) {
  if (!fluxo || !fluxo.length) return { dias: null, dia: null }
  const neg = fluxo.find((d) => Number(d.vSaldo) < 0)
  if (!neg) return { dias: null, dia: null }
  return { dias: diasEntre(fluxo[0].dDia, neg.dDia), dia: neg.dDia }
}

// Estatísticas de uma métrica numa janela de snapshots: início, fim, variação, pico, vale, média
export function estatisticasPeriodo(janela, getV) {
  if (!janela || janela.length === 0) return null
  const pts = janela.map((r) => ({ data: r.data, v: getV(r) }))
  const inicio = pts[0]
  const fim = pts[pts.length - 1]
  let pico = pts[0], vale = pts[0], soma = 0
  for (const p of pts) {
    if (p.v > pico.v) pico = p
    if (p.v < vale.v) vale = p
    soma += p.v
  }
  const delta = fim.v - inicio.v
  const pct = inicio.v !== 0 ? (delta / Math.abs(inicio.v)) * 100 : null
  return { inicio, fim, delta, pct, pico, vale, media: soma / pts.length }
}

// Delta do último ponto vs anterior numa série de números
export function calcDelta(serie) {
  if (!serie || serie.length < 2) return null
  const atual = Number(serie[serie.length - 1] || 0)
  const anterior = Number(serie[serie.length - 2] || 0)
  const delta = atual - anterior
  const pct = anterior !== 0 ? (delta / Math.abs(anterior)) * 100 : null
  return { atual, anterior, delta, pct }
}
