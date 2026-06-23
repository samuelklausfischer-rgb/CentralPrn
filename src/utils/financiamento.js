// Lógica de financiamentos / compromissos a partir de Contas a Pagar EM ABERTO.
//
// Premissa validada nos dados reais da Omie (PRN/MedImagem): não existe cadastro de
// "máquina" nem de "contrato de financiamento". Cada parcela é um título em Contas a
// Pagar com `numero_parcela` no formato "atual/total" (ex.: "014/025"). Reconstruímos o
// "contrato" agrupando as parcelas em aberto por fornecedor + categoria + valor + total.
// A própria parcela ("014/025") já revela 13 pagas / 12 restantes, sem varrer o histórico.

import { parseOmieDate } from './dates.js'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Padrão de classificação de "financiamento de longo prazo": separa financiamentos/
// contratos plurianuais (24x, 36x, 48x...) das recorrências anuais 12x/13x (PJ, salários,
// serviços), que dominam a base. Ajustável pela UI.
export const CFG_FINANCIAMENTO_PADRAO = { minParcelas: 14, minValorParcela: 1000 }

// "014/025" -> { atual: 14, total: 25 }
export function parseParcela(np) {
  const s = String(np || '').trim()
  const m = s.match(/(\d+)\s*\/\s*(\d+)/)
  if (!m) return { atual: 1, total: 1 }
  return { atual: Number(m[1]) || 1, total: Number(m[2]) || 1 }
}

function ord(dataBR) {
  const d = parseOmieDate(dataBR)
  return d ? d.getTime() : Infinity
}

// Agrupa os títulos EM ABERTO em "contratos" (séries de parcelas).
// itens: [{ id, fornecedorCod, fornecedor, categoriaCod, categoria, numeroParcela,
//           valor, venc, status, documento, empresa }]
export function agruparContratos(itens, hoje = new Date()) {
  const grupos = new Map()
  for (const it of itens || []) {
    const { total } = parseParcela(it.numeroParcela)
    const chave = [it.empresa || '', it.fornecedorCod || '?', it.categoriaCod || '?', total, Math.round(Number(it.valor) || 0)].join('|')
    if (!grupos.has(chave)) grupos.set(chave, [])
    grupos.get(chave).push(it)
  }

  const contratos = []
  for (const [chave, parcelas] of grupos) {
    parcelas.sort((a, b) => ord(a.venc) - ord(b.venc))
    const { total: parcTotal } = parseParcela(parcelas[0].numeroParcela)
    const valores = parcelas.map((p) => Number(p.valor) || 0)
    const valorParcela = valores.sort((a, b) => a - b)[Math.floor(valores.length / 2)] // mediana
    const atuais = parcelas.map((p) => parseParcela(p.numeroParcela).atual).filter((n) => n > 0)
    const proximaParcela = atuais.length ? Math.min(...atuais) : 1
    const parcelasPagas = Math.max(0, proximaParcela - 1)
    const abertasCount = parcelas.length
    const parcelasRestantes = parcTotal > 1 ? Math.max(abertasCount, parcTotal - parcelasPagas) : abertasCount
    const saldoRestante = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0)
    const valorTotal = parcTotal > 1 ? valorParcela * parcTotal : saldoRestante
    const totalPago = Math.max(0, valorTotal - saldoRestante)
    const venceAbertas = parcelas.map((p) => p.venc).filter(Boolean)
    const quitacaoPrevista = venceAbertas.reduce((a, b) => (ord(b) > ord(a) ? b : a), venceAbertas[0])
    const proximoVenc = venceAbertas.reduce((a, b) => (ord(b) < ord(a) ? b : a), venceAbertas[0])
    const atrasadas = parcelas.filter((p) => {
      const d = parseOmieDate(p.venc)
      return /ATRAS/i.test(p.status || '') || (d && d < hoje && !/PAGO/i.test(p.status || ''))
    })
    contratos.push({
      chave,
      empresa: parcelas[0].empresa,
      fornecedor: parcelas[0].fornecedor || `Fornecedor ${parcelas[0].fornecedorCod}`,
      fornecedorCod: parcelas[0].fornecedorCod,
      categoria: parcelas[0].categoria || parcelas[0].categoriaCod || '—',
      categoriaCod: parcelas[0].categoriaCod,
      documento: parcelas[0].documento,
      valorParcela,
      parcTotal,
      parcelasPagas,
      parcelasRestantes,
      pctQuitado: parcTotal > 1 ? (parcelasPagas / parcTotal) * 100 : null,
      valorTotal,
      totalPago,
      saldoRestante,
      proximoVenc,
      quitacaoPrevista,
      atrasadas: atrasadas.length,
      valorAtrasado: atrasadas.reduce((s, p) => s + (Number(p.valor) || 0), 0),
      quitacaoISO: parseOmieDate(quitacaoPrevista)?.getTime() ?? Infinity, // p/ ordenar por "quita primeiro"
      proximoVencISO: parseOmieDate(proximoVenc)?.getTime() ?? Infinity,
      ehFinanciamento: false, // marcado em computarView
    })
  }
  // Maior saldo devedor primeiro
  return contratos.sort((a, b) => b.saldoRestante - a.saldoRestante)
}

export function ehFinanciamento(contrato, cfg = CFG_FINANCIAMENTO_PADRAO) {
  return contrato.parcTotal >= cfg.minParcelas && contrato.valorParcela >= cfg.minValorParcela
}

// Concentração: o quanto do saldo devedor está nos maiores credores.
export function concentracao(financiamentos) {
  const ord = [...(financiamentos || [])].sort((a, b) => b.saldoRestante - a.saldoRestante)
  const total = ord.reduce((s, c) => s + (Number(c.saldoRestante) || 0), 0)
  const top1 = ord[0]?.saldoRestante || 0
  const top3 = ord.slice(0, 3).reduce((s, c) => s + (Number(c.saldoRestante) || 0), 0)
  return {
    total,
    pctTop1: total > 0 ? (top1 / total) * 100 : 0,
    pctTop3: total > 0 ? (top3 / total) * 100 : 0,
    top1Nome: ord[0]?.fornecedor || '—',
  }
}

// Visão completa da página, computada de uma vez (reutilizada na tela e ao salvar no banco).
export function computarView(itens, cfg = CFG_FINANCIAMENTO_PADRAO) {
  const contratos = agruparContratos(itens)
  for (const c of contratos) c.ehFinanciamento = ehFinanciamento(c, cfg)
  const financiamentos = contratos.filter((c) => c.ehFinanciamento)
  return {
    contratos,
    financiamentos,
    resumo: resumoCompromissos(itens),
    buckets: bucketsVencimentoMensal(itens, 12),
    porCategoria: agruparPor(itens, 'categoria', 8),
    porFornecedor: agruparPor(itens, 'fornecedor', 8),
    conc: concentracao(financiamentos),
  }
}

// Soma duas listas [{nome,valor,qtd}] por nome e mantém top N + "Outros".
function somarPorNome(l1 = [], l2 = [], topN = 8) {
  const m = new Map()
  for (const x of [...l1, ...l2]) {
    if (x.nome === 'Outros') continue
    const e = m.get(x.nome) || { nome: x.nome, valor: 0, qtd: 0 }
    e.valor += x.valor || 0; e.qtd += x.qtd || 0; m.set(x.nome, e)
  }
  let outros = [...l1, ...l2].filter((x) => x.nome === 'Outros').reduce((s, x) => s + (x.valor || 0), 0)
  const arr = [...m.values()].sort((a, b) => b.valor - a.valor)
  if (arr.length > topN) {
    outros += arr.slice(topN).reduce((s, x) => s + x.valor, 0)
    return [...arr.slice(0, topN), { nome: 'Outros', valor: outros, qtd: 0 }]
  }
  return outros > 0 ? [...arr, { nome: 'Outros', valor: outros, qtd: 0 }] : arr
}

// Consolida duas visões (PRN + MedImagem). Aceita uma nula.
export function mergeViews(a, b) {
  if (!a) return b
  if (!b) return a
  const buckets = (a.buckets || []).map((bk, i) => ({
    nome: bk.nome,
    valor: (bk.valor || 0) + (b.buckets?.[i]?.valor || 0),
    qtd: (bk.qtd || 0) + (b.buckets?.[i]?.qtd || 0),
  }))
  const financiamentos = [...(a.financiamentos || []), ...(b.financiamentos || [])]
  const sr = (o, k) => Number(o?.resumo?.[k] || 0)
  return {
    contratos: [...(a.contratos || []), ...(b.contratos || [])],
    financiamentos,
    resumo: {
      totalAberto: sr(a, 'totalAberto') + sr(b, 'totalAberto'),
      totalAtrasado: sr(a, 'totalAtrasado') + sr(b, 'totalAtrasado'),
      qtdAtrasado: sr(a, 'qtdAtrasado') + sr(b, 'qtdAtrasado'),
      prox30: sr(a, 'prox30') + sr(b, 'prox30'),
      prox90: sr(a, 'prox90') + sr(b, 'prox90'),
      qtd: sr(a, 'qtd') + sr(b, 'qtd'),
    },
    buckets,
    porCategoria: somarPorNome(a.porCategoria, b.porCategoria),
    porFornecedor: somarPorNome(a.porFornecedor, b.porFornecedor),
    conc: concentracao(financiamentos),
  }
}

// Buckets mensais de vencimento (impacto no caixa) — próximos N meses a partir de hoje.
export function bucketsVencimentoMensal(itens, meses = 12, hoje = new Date()) {
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const buckets = []
  const idx = new Map()
  for (let i = 0; i < meses; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
    const nome = `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
    idx.set(`${d.getFullYear()}-${d.getMonth()}`, buckets.length)
    buckets.push({ nome, valor: 0, qtd: 0 })
  }
  for (const it of itens || []) {
    const d = parseOmieDate(it.venc)
    if (!d) continue
    const k = `${d.getFullYear()}-${d.getMonth()}`
    if (idx.has(k)) {
      const b = buckets[idx.get(k)]
      b.valor += Number(it.valor) || 0
      b.qtd += 1
    }
  }
  return buckets
}

// Resumo geral dos compromissos em aberto.
export function resumoCompromissos(itens, hoje = new Date()) {
  let totalAberto = 0, totalAtrasado = 0, qtdAtrasado = 0, prox30 = 0, prox90 = 0
  const limite30 = new Date(hoje); limite30.setDate(limite30.getDate() + 30)
  const limite90 = new Date(hoje); limite90.setDate(limite90.getDate() + 90)
  for (const it of itens || []) {
    const v = Number(it.valor) || 0
    totalAberto += v
    const d = parseOmieDate(it.venc)
    const atrasado = /ATRAS/i.test(it.status || '') || (d && d < hoje)
    if (atrasado) { totalAtrasado += v; qtdAtrasado += 1 }
    else if (d) {
      if (d <= limite30) prox30 += v
      if (d <= limite90) prox90 += v
    }
  }
  return { totalAberto, totalAtrasado, qtdAtrasado, prox30, prox90, qtd: (itens || []).length }
}

// Agrupa por um campo (categoria/fornecedor) -> [{ nome, valor, qtd }] top N, com "Outros".
export function agruparPor(itens, campo, topN = 8) {
  const m = new Map()
  for (const it of itens || []) {
    const nome = it[campo] || '—'
    const e = m.get(nome) || { nome, valor: 0, qtd: 0 }
    e.valor += Number(it.valor) || 0
    e.qtd += 1
    m.set(nome, e)
  }
  const arr = [...m.values()].sort((a, b) => b.valor - a.valor)
  if (arr.length <= topN) return arr
  const top = arr.slice(0, topN)
  const outros = arr.slice(topN).reduce((s, x) => ({ nome: 'Outros', valor: s.valor + x.valor, qtd: s.qtd + x.qtd }), { nome: 'Outros', valor: 0, qtd: 0 })
  return [...top, outros]
}
