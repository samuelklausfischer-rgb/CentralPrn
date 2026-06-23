import { hojeISO } from './dates.js'

export const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// ── DRE: parse de ListarOrcamentos → estrutura de demonstrativo ──────────────
// Extrai o nValorRealizado de um código de categoria específico
export function vReal(lista, cod) {
  return Number(lista.find((c) => c.cCodCateg === cod)?.nValorRealizado || 0)
}

// Transforma ListaOrcamentos em estrutura de DRE
export function parseDRE(lista) {
  if (!lista || lista.length === 0) return null
  const receitas     = vReal(lista, '1')
  const faturBruto   = vReal(lista, '1.01')
  const impostos     = vReal(lista, '1.02')
  const deducoes     = vReal(lista, '1.03')
  const recFinanc    = vReal(lista, '1.04')
  const recTransit   = vReal(lista, '1.05')
  const despesas     = vReal(lista, '2')
  const custoServico = vReal(lista, '2.01')
  const despVariavel = vReal(lista, '2.02')
  const despFixa     = vReal(lista, '2.03')
  const despOutros   = despesas - custoServico - despVariavel - despFixa
  const resultado    = receitas - despesas
  const margem       = receitas > 0 ? (resultado / receitas) * 100 : null
  return { receitas, faturBruto, impostos, deducoes, recFinanc, recTransit, despesas, custoServico, despVariavel, despFixa, despOutros, resultado, margem }
}

// Soma dois DREs (consolidação de empresas OU soma de meses). Recalcula a margem
// a partir dos campos somados. Trata nulos: serve em reduce((acc,d)=>mergeDRE(acc,d), null).
export function mergeDRE(d1, d2) {
  if (!d1 && !d2) return null
  if (!d1) return d2
  if (!d2) return d1
  const sum = (k) => Number(d1[k] || 0) + Number(d2[k] || 0)
  const FIELDS = ['receitas', 'faturBruto', 'impostos', 'deducoes', 'recFinanc', 'recTransit', 'despesas', 'custoServico', 'despVariavel', 'despFixa', 'despOutros', 'resultado']
  const m = {}
  FIELDS.forEach((f) => { m[f] = sum(f) })
  m.margem = m.receitas > 0 ? (m.resultado / m.receitas) * 100 : null
  return m
}

// ── Período → meses calendário (para a cascata DRE, que é mensal) ────────────
// Períodos curtos (<=1 mês) → mês vigente. Longos → últimos N meses (inclui o vigente).
// 1 ano fica capado em 6 meses para conter chamadas Omie (anti-425).
const MESES_POR_PERIODO = { hoje: 1, ontem: 1, '7d': 1, '15d': 1, '1m': 1, '2m': 2, '3m': 3, '6m': 6, '1a': 6 }

// Retorna [{ nAno, nMes }] do mais recente para o mais antigo.
export function resolverMesesPeriodo(periodoKey) {
  const n = MESES_POR_PERIODO[periodoKey] ?? 1
  const [ano, mes] = hojeISO().split('-').map(Number)
  const meses = []
  let a = ano, m = mes
  for (let i = 0; i < n; i++) {
    meses.push({ nAno: a, nMes: m })
    m -= 1
    if (m < 1) { m = 12; a -= 1 }
  }
  return meses
}

// "Jun/2026" para 1 mês; "Abr–Jun/2026" (ou cruzando ano "Out/2025–Mar/2026") para vários.
export function periodoFraseDRE(meses) {
  if (!meses || meses.length === 0) return ''
  const ab = (mm) => MESES_ABREV[mm.nMes - 1]
  if (meses.length === 1) return `${ab(meses[0])}/${meses[0].nAno}`
  const recente = meses[0]
  const antigo = meses[meses.length - 1]
  if (antigo.nAno === recente.nAno) return `${ab(antigo)}–${ab(recente)}/${recente.nAno}`
  return `${ab(antigo)}/${antigo.nAno}–${ab(recente)}/${recente.nAno}`
}

// Deriva a cascata leiga a partir do DRE somado. resultado/margem permanecem os
// valores autoritativos da Omie (não recalculados a partir das linhas).
export function derivarCascata(dre) {
  if (!dre) return null
  const faturBruto       = Number(dre.faturBruto || 0)
  const impostos         = Number(dre.impostos || 0)
  const deducoes         = Number(dre.deducoes || 0)
  const impostosDeducoes = impostos + deducoes
  const liquida          = faturBruto - impostosDeducoes
  const custos           = Number(dre.custoServico || 0)
  const despesas         = Number(dre.despFixa || 0) + Number(dre.despVariavel || 0) + Number(dre.despOutros || 0)
  const despFixa         = Number(dre.despFixa || 0)
  const despVariavel     = Number(dre.despVariavel || 0)
  const despOutros       = Number(dre.despOutros || 0)
  const recFinanc        = Number(dre.recFinanc || 0)
  const recTransit       = Number(dre.recTransit || 0)
  const extras           = recFinanc + recTransit
  const resultado        = Number(dre.resultado || 0)
  const margem           = dre.margem

  // Subcategorias para expandir cada etapa (filtra zeros)
  const filtra = (arr) => arr.filter((i) => i.valor > 0)
  const impostosItens = filtra([
    { nome: 'Impostos sobre serviço', valor: impostos },
    { nome: 'Deduções e cancelamentos', valor: deducoes },
  ])
  const despesasItens = filtra([
    { nome: 'Despesas fixas', valor: despFixa },
    { nome: 'Despesas variáveis', valor: despVariavel },
    { nome: 'Outras despesas', valor: despOutros },
  ])
  const extrasItens = filtra([
    { nome: 'Receitas financeiras', valor: recFinanc },
    { nome: 'Conta transitória', valor: recTransit },
  ])

  return {
    faturBruto, impostos, deducoes, impostosDeducoes, liquida, custos, despesas, extras, resultado, margem,
    impostosItens, despesasItens, extrasItens,
  }
}

// ── Tendência + sparkline a partir do histórico de snapshots (sem nova API) ───
// campo: string (chave do snapshot) OU função (r)=>Number. valorHoje é o valor live
// (autoritativo, do resumo Omie). Retorna null se não houver série suficiente.
// NÃO decide bomQuando — quem chama injeta (mesmo campo pode ser bom subir ou cair).
export function serieTrend(histAll, campo, valorHoje, dias = 30) {
  if (!histAll || histAll.length < 2) return null
  const get = typeof campo === 'function' ? campo : (r) => Number(r[campo] || 0)
  const serie = histAll.map(get).filter((v) => Number.isFinite(v))
  if (serie.length < 2) return null
  const sparkData = serie.slice(-dias)

  const hoje = new Date(hojeISO())
  const tol = Math.max(5, Math.round(dias / 6))
  const ref = histAll.find((r) => {
    const d = Math.round((hoje - new Date(r.data)) / 86400000)
    return d >= dias - tol && d <= dias + tol
  })
  const atual = Number.isFinite(valorHoje) ? Number(valorHoje) : serie[serie.length - 1]
  if (!ref) return { delta: null, pct: null, sparkData }
  const base = get(ref)
  const delta = atual - base
  const pct = base !== 0 ? (delta / Math.abs(base)) * 100 : null
  return { delta, pct, sparkData }
}

// ── Classificação de saúde financeira (null-safe) ────────────────────────────
// Qualquer sinal sem dado vira 'ignorado' e NUNCA rebaixa a saúde (evita falso alarme).
export function classificarSaude({ caixa, liquidez, runway, burnDia, pctInad, atrasoPagar, primeiroNeg, projValida }) {
  const sinais = []

  if (caixa != null) sinais.push({ chave: 'caixa', nivel: caixa < 0 ? 'ruim' : 'bom', texto: caixa < 0 ? 'Caixa negativo hoje' : 'Caixa positivo' })

  if (projValida && primeiroNeg) sinais.push({ chave: 'projecao', nivel: 'ruim', texto: `Caixa fica negativo em ${primeiroNeg.dDia}` })
  else if (projValida) sinais.push({ chave: 'projecao', nivel: 'bom', texto: 'Projeção de caixa positiva' })
  else sinais.push({ chave: 'projecao', nivel: 'ignorado', texto: 'Projeção indisponível' })

  if (liquidez != null) sinais.push({ chave: 'liquidez', nivel: liquidez < 1 ? 'ruim' : liquidez < 1.5 ? 'atencao' : 'bom', texto: `Liquidez ${liquidez.toFixed(1)}` })
  else sinais.push({ chave: 'liquidez', nivel: 'ignorado', texto: 'Liquidez não se aplica' })

  if (runway != null) sinais.push({ chave: 'runway', nivel: runway < 90 ? 'ruim' : runway < 180 ? 'atencao' : 'bom', texto: `Fôlego ~${Math.round(runway / 30)} ${Math.round(runway / 30) === 1 ? 'mês' : 'meses'}` })
  else if (burnDia != null && burnDia <= 0) sinais.push({ chave: 'runway', nivel: 'bom', texto: 'Caixa em crescimento' })
  else sinais.push({ chave: 'runway', nivel: 'ignorado', texto: 'Fôlego aguardando histórico' })

  if (pctInad != null) sinais.push({ chave: 'inad', nivel: pctInad >= 25 ? 'ruim' : pctInad >= 10 ? 'atencao' : 'bom', texto: `Inadimplência ${Math.round(pctInad)}%` })

  if (atrasoPagar != null) sinais.push({ chave: 'pagarAtraso', nivel: atrasoPagar > 0 ? 'atencao' : 'bom', texto: atrasoPagar > 0 ? 'Contas a pagar em atraso' : 'Contas a pagar em dia' })

  return sinais
}
