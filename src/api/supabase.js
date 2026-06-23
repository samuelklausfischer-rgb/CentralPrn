import { createClient } from '@supabase/supabase-js'
import { hojeISO, parseOmieDate, isoParaBR } from '../utils/dates.js'
import { env } from '../env.js'

const url = env('VITE_SUPABASE_URL')
const key = env('VITE_SUPABASE_ANON_KEY')

export const supabase = url && key ? createClient(url, key) : null

const TABLE = 'dash_snapshot_financeiro'

// Todos os snapshots de uma empresa (asc). Dataset pequeno; a tela fatia por período no client.
export async function fetchTodosSnapshots(empresa = 'prn') {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, caixa, a_receber, a_receber_atraso, a_receber_qtd, a_pagar, a_pagar_atraso, a_pagar_qtd')
    .eq('empresa', empresa)
    .order('data', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

function rowFromResumo(dataISO, resumo, empresa) {
  const cc = resumo.contaCorrente || {}, cr = resumo.contaReceber || {}, cp = resumo.contaPagar || {}
  return {
    data: dataISO,
    empresa,
    caixa: Number(cc.vTotal || 0),
    a_receber: Number(cr.vTotal || 0),
    a_receber_atraso: Number(cr.vAtraso || 0),
    a_receber_qtd: Number(cr.nTotal || 0),
    a_pagar: Number(cp.vTotal || 0),
    a_pagar_atraso: Number(cp.vAtraso || 0),
    a_pagar_qtd: Number(cp.nTotal || 0),
    atualizado_em: new Date().toISOString(),
  }
}

// Upsert de um dia arbitrário (usado pelo self-heal de lacunas)
export async function upsertSnapshotData(dataISO, resumo, empresa = 'prn') {
  if (!supabase || !resumo) return
  const { error } = await supabase
    .from(TABLE)
    .upsert(rowFromResumo(dataISO, resumo, empresa), { onConflict: 'data,empresa' })
  if (error) throw new Error(error.message)
}

// Grava (upsert) o snapshot de hoje a partir do resumo do Omie. Fire-and-forget.
export async function upsertSnapshotHoje(resumo, empresa = 'prn') {
  if (!supabase || !resumo) return
  await upsertSnapshotData(hojeISO(), resumo, empresa)
}

// ── FINANCIAMENTOS & COMPROMISSOS ────────────────────────────────────────────
// Tabelas: dash_financiamento_snapshot (agregado diário) e
//          dash_financiamento_contrato (detalhe por financiamento, por dia).

const TB_FIN_SNAP = 'dash_financiamento_snapshot'
const TB_FIN_CONTR = 'dash_financiamento_contrato'

// Converte data Omie "dd/mm/aaaa" -> ISO "yyyy-mm-dd" (ou null) p/ colunas date.
function omieParaISO(s) {
  const d = parseOmieDate(s)
  if (!d) return null
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Mapeia uma linha do banco (dash_financiamento_contrato) para a forma usada na tela.
function dbContratoParaView(r) {
  return {
    chave: r.chave,
    empresa: r.empresa,
    fornecedor: r.fornecedor || `Fornecedor ${r.fornecedor_cod}`,
    fornecedorCod: r.fornecedor_cod,
    categoria: r.categoria || '—',
    categoriaCod: r.categoria_cod,
    documento: r.documento,
    valorParcela: Number(r.valor_parcela) || 0,
    parcTotal: Number(r.parcelas_total) || 0,
    parcelasPagas: Number(r.parcelas_pagas) || 0,
    parcelasRestantes: Number(r.parcelas_restantes) || 0,
    pctQuitado: r.pct_quitado != null ? Number(r.pct_quitado) : null,
    valorTotal: Number(r.valor_total) || 0,
    totalPago: Number(r.total_pago) || 0,
    saldoRestante: Number(r.saldo_devedor) || 0,
    proximoVenc: isoParaBR(r.proximo_venc),
    quitacaoPrevista: isoParaBR(r.quitacao_prevista),
    quitacaoISO: r.quitacao_prevista ? new Date(r.quitacao_prevista).getTime() : Infinity,
    proximoVencISO: r.proximo_venc ? new Date(r.proximo_venc).getTime() : Infinity,
    atrasadas: Number(r.parcelas_atrasadas) || 0,
    valorAtrasado: Number(r.valor_atrasado) || 0,
    ehFinanciamento: !!r.eh_financiamento,
  }
}

// Persiste a visão completa de uma empresa (todos os contratos + agregados em `detalhe`),
// de forma que a tela consiga renderizar tudo direto do banco. Fire-and-forget.
// view: saída de computarView() -> { contratos, financiamentos, resumo, buckets, porCategoria, porFornecedor, conc }
export async function salvarFinanciamentos(empresa = 'prn', view = {}) {
  if (!supabase) return
  const { contratos = [], financiamentos = [], resumo = {}, buckets = [], porCategoria = [], porFornecedor = [], conc = {} } = view
  const dataISO = hojeISO()
  const agora = new Date().toISOString()
  try {
    const snap = {
      data: dataISO,
      empresa,
      saldo_devedor_financiamentos: financiamentos.reduce((s, c) => s + (Number(c.saldoRestante) || 0), 0),
      qtd_financiamentos: financiamentos.length,
      parcela_mensal_financiamentos: financiamentos.reduce((s, c) => s + (Number(c.valorParcela) || 0), 0),
      valor_atrasado_financiamentos: financiamentos.reduce((s, c) => s + (Number(c.valorAtrasado) || 0), 0),
      total_aberto: Number(resumo.totalAberto || 0),
      qtd_titulos_aberto: Number(resumo.qtd || 0),
      total_atrasado: Number(resumo.totalAtrasado || 0),
      qtd_titulos_atrasado: Number(resumo.qtdAtrasado || 0),
      vence_30d: Number(resumo.prox30 || 0),
      vence_90d: Number(resumo.prox90 || 0),
      detalhe: { buckets, porCategoria, porFornecedor, conc },
      atualizado_em: agora,
    }
    await supabase.from(TB_FIN_SNAP).upsert(snap, { onConflict: 'data,empresa' })

    // Regrava o detalhe do dia do zero (limpa antes p/ não deixar contratos órfãos).
    await supabase.from(TB_FIN_CONTR).delete().eq('data', dataISO).eq('empresa', empresa)
    if (contratos.length) {
      const rows = contratos.map((c) => ({
        data: dataISO,
        empresa,
        chave: c.chave,
        fornecedor: c.fornecedor || null,
        fornecedor_cod: c.fornecedorCod ?? null,
        categoria: c.categoria || null,
        categoria_cod: c.categoriaCod || null,
        documento: c.documento || null,
        valor_parcela: Number(c.valorParcela) || 0,
        parcelas_total: Number(c.parcTotal) || 0,
        parcelas_pagas: Number(c.parcelasPagas) || 0,
        parcelas_restantes: Number(c.parcelasRestantes) || 0,
        pct_quitado: c.pctQuitado != null ? Number(c.pctQuitado) : null,
        valor_total: Number(c.valorTotal) || 0,
        total_pago: Number(c.totalPago) || 0,
        saldo_devedor: Number(c.saldoRestante) || 0,
        proximo_venc: omieParaISO(c.proximoVenc),
        quitacao_prevista: omieParaISO(c.quitacaoPrevista),
        parcelas_atrasadas: Number(c.atrasadas) || 0,
        valor_atrasado: Number(c.valorAtrasado) || 0,
        eh_financiamento: !!c.ehFinanciamento,
        atualizado_em: agora,
      }))
      // insere em lotes p/ não estourar limite de payload
      for (let i = 0; i < rows.length; i += 200) {
        await supabase.from(TB_FIN_CONTR).insert(rows.slice(i, i + 200))
      }
    }
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('salvarFinanciamentos falhou:', e?.message || e)
  }
}

// Lê do banco a última visão salva de uma empresa (render instantâneo ao abrir a tela).
// Retorna { data, atualizadoEm, view } no MESMO formato de computarView(), ou null.
export async function fetchFinanciamentoDB(empresa = 'prn') {
  if (!supabase) return null
  const { data: snaps, error: e1 } = await supabase
    .from(TB_FIN_SNAP).select('*').eq('empresa', empresa).order('data', { ascending: false }).limit(1)
  if (e1 || !snaps || !snaps.length) return null
  const snap = snaps[0]
  const { data: contrRows, error: e2 } = await supabase
    .from(TB_FIN_CONTR).select('*').eq('empresa', empresa).eq('data', snap.data)
  if (e2) return null
  const contratos = (contrRows || []).map(dbContratoParaView).sort((a, b) => b.saldoRestante - a.saldoRestante)
  const det = snap.detalhe || {}
  const view = {
    contratos,
    financiamentos: contratos.filter((c) => c.ehFinanciamento),
    resumo: {
      totalAberto: Number(snap.total_aberto) || 0,
      totalAtrasado: Number(snap.total_atrasado) || 0,
      qtdAtrasado: Number(snap.qtd_titulos_atrasado) || 0,
      prox30: Number(snap.vence_30d) || 0,
      prox90: Number(snap.vence_90d) || 0,
      qtd: Number(snap.qtd_titulos_aberto) || 0,
    },
    buckets: det.buckets || [],
    porCategoria: det.porCategoria || [],
    porFornecedor: det.porFornecedor || [],
    conc: det.conc || {},
  }
  return { data: snap.data, atualizadoEm: snap.atualizado_em, view }
}

// Histórico do portfólio de financiamentos (para gráfico de evolução do endividamento).
export async function fetchFinanciamentoHistorico(empresa = 'prn') {
  if (!supabase) return []
  const { data, error } = await supabase
    .from(TB_FIN_SNAP)
    .select('data, saldo_devedor_financiamentos, qtd_financiamentos, parcela_mensal_financiamentos, total_aberto, total_atrasado')
    .eq('empresa', empresa)
    .order('data', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}
