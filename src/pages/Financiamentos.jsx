import { useState, useMemo } from 'react'
import { useFinanciamentos } from '../hooks/useFinanciamentos.js'
import EmpresaTabs from '../components/EmpresaTabs.jsx'
import KpiCard from '../components/KpiCard.jsx'
import BarRanking from '../components/BarRanking.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import TabelaContratos from '../components/TabelaContratos.jsx'
import { fmt, fmtBig, fmtPct } from '../utils/format.js'
import { mergeViews, CFG_FINANCIAMENTO_PADRAO } from '../utils/financiamento.js'

function SectionHeader({ titulo, subtitulo }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 h-5 w-[3px] shrink-0 rounded-full bg-[#F26522]" />
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#0D2B55]">{titulo}</h2>
        {subtitulo && <p className="text-[11px] text-gray-400 mt-0.5">{subtitulo}</p>}
      </div>
    </div>
  )
}

function Bloco({ titulo, sub, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
      {sub && <p className="mb-3 text-xs text-gray-400">{sub}</p>}
      <div className={sub ? '' : 'mt-3'}>{children}</div>
    </div>
  )
}

const CORES_MES = ['#0D2B55', '#1A4A8A', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd']
const ANO_MS = 365 * 24 * 3600 * 1000

const ORDENACOES = [
  { key: 'quitacao', dir: 'asc',  label: 'Quita primeiro' },
  { key: 'saldo',    dir: 'desc', label: 'Maior saldo' },
  { key: 'parcela',  dir: 'desc', label: 'Maior parcela' },
  { key: 'quitado',  dir: 'desc', label: 'Mais quitado' },
]
const FILTROS = [
  { key: 'todos',     label: 'Todos' },
  { key: 'atrasados', label: 'Com atraso' },
  { key: 'quita12',   label: 'Quita ≤ 12 meses' },
  { key: 'quase',     label: 'Quase quitados' },
]

function fmtQuando(v) {
  if (!v) return ''
  const d = typeof v === 'number' ? new Date(v) : new Date(v)
  if (isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Financiamentos() {
  const [empresa, setEmpresa] = useState('prn')
  const [verTodos, setVerTodos] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [sort, setSort] = useState({ key: 'quitacao', dir: 'asc' })

  const isCons = empresa === 'consolidado'
  const isMed = empresa === 'medimagem'

  const finPRN = useFinanciamentos('prn', { enabled: empresa === 'prn' || isCons, apiEnabled: empresa === 'prn' || isCons })
  const finMed = useFinanciamentos('medimagem', { enabled: isMed || isCons, apiEnabled: isMed || (isCons && !finPRN.atualizando) })

  const view = useMemo(
    () => (isCons ? mergeViews(finPRN.view, finMed.view) : isMed ? finMed.view : finPRN.view),
    [isCons, isMed, finPRN.view, finMed.view]
  )

  const atualizando = isCons ? (finPRN.atualizando || finMed.atualizando) : isMed ? finMed.atualizando : finPRN.atualizando
  const fonte = isCons
    ? (finPRN.fonte === 'omie' && (finMed.fonte === 'omie' || !finMed.view) ? 'omie' : 'banco')
    : isMed ? finMed.fonte : finPRN.fonte
  const error = isCons ? (finPRN.error || finMed.error) : isMed ? finMed.error : finPRN.error
  const retryAfter = isCons ? (finPRN.retryAfter ?? finMed.retryAfter) : isMed ? finMed.retryAfter : finPRN.retryAfter
  const retry = isCons ? () => { finPRN.retry(); finMed.retry() } : isMed ? finMed.retry : finPRN.retry
  const progress = isCons ? (finPRN.progress?.total ? finPRN.progress : finMed.progress) : isMed ? finMed.progress : finPRN.progress
  const atualizadoEm = isCons ? (finPRN.atualizadoEm || finMed.atualizadoEm) : isMed ? finMed.atualizadoEm : finPRN.atualizadoEm
  const empresaLabel = isCons ? 'Consolidado (PRN + MedImagem)' : isMed ? 'MedImagem' : 'PRN'

  // ── Sem nada para mostrar ainda (primeira carga sem banco) ──
  if (!view) {
    return (
      <div className="flex-1 p-6">
        <div className="mb-5"><EmpresaTabs value={empresa} onChange={setEmpresa} /></div>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
            <p className="text-sm font-semibold text-red-700">Erro ao carregar os compromissos</p>
            <p className="mt-2 text-xs text-red-500 max-w-md mx-auto">{error}</p>
            <div className="mt-4">
              {retryAfter !== null ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700">⏱ Tentando em {retryAfter}s</span>
              ) : (
                <button onClick={retry} className="rounded-md bg-[#0D2B55] px-4 py-2 text-xs font-medium text-white hover:bg-blue-900">↺ Tentar novamente</button>
              )}
            </div>
          </div>
        ) : (
          <>
            <LoadingSpinner message={`Carregando ${isCons ? '(PRN + MedImagem)' : empresa.toUpperCase()}` + (progress?.total > 1 ? ` — página ${progress.pagina} de ${progress.total}` : '...')} />
            <p className="mt-2 text-center text-xs text-gray-400">Primeira vez: varrendo as contas a pagar na Omie. Depois abre na hora pelo banco.</p>
          </>
        )}
      </div>
    )
  }

  // ── Dados derivados da visão ──
  const financiamentos = view.financiamentos || []
  const contratos = view.contratos || []
  const resumo = view.resumo || {}
  const buckets = view.buckets || []
  const porCategoria = view.porCategoria || []
  const porFornecedor = view.porFornecedor || []
  const conc = view.conc || {}
  const agora = Date.now()

  const saldoFinanc = financiamentos.reduce((s, c) => s + (c.saldoRestante || 0), 0)
  const parcelaMensal = financiamentos.reduce((s, c) => s + (c.valorParcela || 0), 0)
  const atrasoFinanc = financiamentos.reduce((s, c) => s + (c.valorAtrasado || 0), 0)
  const quita12 = financiamentos.filter((c) => c.quitacaoISO <= agora + ANO_MS).length

  // ── Filtro + ordenação da tabela ──
  const base = verTodos ? contratos : financiamentos
  const filtrada = base.filter((c) => {
    if (busca) { const q = busca.toLowerCase(); if (!`${c.fornecedor} ${c.categoria}`.toLowerCase().includes(q)) return false }
    if (filtro === 'atrasados' && !(c.atrasadas > 0)) return false
    if (filtro === 'quita12' && !(c.quitacaoISO <= agora + ANO_MS)) return false
    if (filtro === 'quase' && !((c.pctQuitado ?? 0) >= 75)) return false
    return true
  })
  const valFn = {
    quitacao: (c) => c.quitacaoISO ?? Infinity,
    proxvenc: (c) => c.proximoVencISO ?? Infinity,
    saldo: (c) => c.saldoRestante || 0,
    parcela: (c) => c.valorParcela || 0,
    quitado: (c) => c.pctQuitado ?? -1,
  }
  const ordenada = [...filtrada].sort((a, b) => (valFn[sort.key](a) - valFn[sort.key](b)) * (sort.dir === 'asc' ? 1 : -1))
  const onSort = (k) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: k === 'quitacao' || k === 'proxvenc' ? 'asc' : 'desc' }))

  return (
    <div className="flex-1 p-6 overflow-auto">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financiamentos &amp; Compromissos</h1>
          <p className="mt-1 text-sm text-gray-500">{empresaLabel} — parcelas a pagar em aberto (Omie)</p>
        </div>
        <EmpresaTabs value={empresa} onChange={setEmpresa} />
      </div>

      {/* Banner de origem dos dados */}
      {atualizando ? (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-[#0D2B55]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-[#0D2B55]" />
          Mostrando dados salvos{atualizadoEm ? ` de ${fmtQuando(atualizadoEm)}` : ''} — conferindo a Omie{progress?.total > 1 ? ` (página ${progress.pagina}/${progress.total})` : '…'}
        </div>
      ) : error ? (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm text-orange-700">
          <span>Não foi possível atualizar pela Omie agora — mostrando o último salvo{atualizadoEm ? ` (${fmtQuando(atualizadoEm)})` : ''}.</span>
          {retryAfter === null && <button onClick={retry} className="rounded-md bg-[#0D2B55] px-3 py-1 text-xs font-medium text-white hover:bg-blue-900">↺ Tentar</button>}
        </div>
      ) : (
        <div className="mb-4 text-xs text-gray-400">✓ Atualizado da Omie agora · salvo no banco.</div>
      )}

      {atrasoFinanc > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-orange-700">Há {fmt(atrasoFinanc)} em parcelas de financiamento vencidas e não pagas</p>
            <p className="text-xs text-orange-600 mt-0.5">Use o filtro “Com atraso” na tabela para vê-las.</p>
          </div>
        </div>
      )}

      {/* ===== BLOCO 1: PORTFÓLIO ===== */}
      <SectionHeader titulo="Financiamentos de Longo Prazo" subtitulo={`Contratos plurianuais (≥ ${CFG_FINANCIAMENTO_PADRAO.minParcelas}x e parcela ≥ ${fmtBig(CFG_FINANCIAMENTO_PADRAO.minValorParcela)})`} />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Saldo devedor" valor={fmtBig(saldoFinanc)} tone="orange" big sub="Soma do que ainda falta pagar" />
        <KpiCard label="Contratos ativos" valor={String(financiamentos.length)} tone="neutral" sub={`${quita12} quita${quita12 !== 1 ? 'm' : ''} em ≤ 12 meses`} />
        <KpiCard label="Compromisso mensal" valor={fmtBig(parcelaMensal)} tone="blue" sub="Soma das parcelas mensais" />
        <KpiCard label="Em atraso" valor={fmtBig(atrasoFinanc)} tone={atrasoFinanc > 0 ? 'red' : 'green'} sub="Parcelas vencidas não pagas" />
      </div>

      {/* Análise estratégica */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiCard label="Concentração no maior credor" valor={fmtPct(conc.pctTop1 || 0)} tone="neutral" sub={conc.top1Nome ? `${conc.top1Nome}`.slice(0, 28) : '—'} />
        <KpiCard label="Top 3 credores" valor={fmtPct(conc.pctTop3 || 0)} tone="neutral" sub="Parte do saldo nos 3 maiores" />
        <KpiCard label="Total a pagar (todos)" valor={fmtBig(resumo.totalAberto || 0)} tone="neutral" sub={`${resumo.qtd || 0} parcelas em aberto`} />
      </div>

      {/* ===== Controles + Tabela ===== */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor ou categoria…"
            className="w-full sm:w-64 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#0D2B55] focus:outline-none"
          />
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 p-0.5">
            {FILTROS.map((f) => (
              <button key={f.key} onClick={() => setFiltro(f.key)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${filtro === f.key ? 'bg-white text-[#0D2B55] shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Ordenar:</span>
            <select
              value={sort.key}
              onChange={(e) => { const o = ORDENACOES.find((x) => x.key === e.target.value); setSort({ key: o.key, dir: o.dir }) }}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-[#0D2B55] focus:outline-none">
              {ORDENACOES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs">
            <button onClick={() => setVerTodos(false)} className={`rounded-md px-3 py-1 font-medium transition-colors ${!verTodos ? 'bg-[#0D2B55] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Financiamentos ({financiamentos.length})</button>
            <button onClick={() => setVerTodos(true)} className={`rounded-md px-3 py-1 font-medium transition-colors ${verTodos ? 'bg-[#0D2B55] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Todos ({contratos.length})</button>
          </div>
        </div>
        <p className="mb-2 text-xs text-gray-400">{ordenada.length} {ordenada.length === 1 ? 'contrato' : 'contratos'} — clique nos títulos das colunas para ordenar.</p>
        <TabelaContratos contratos={ordenada} mostrarEmpresa={isCons} sortKey={sort.key} sortDir={sort.dir} onSort={onSort} />
      </div>

      <div className="my-8 border-t border-gray-100" />

      {/* ===== BLOCO 2: CALENDÁRIO ===== */}
      <SectionHeader titulo="Calendário de Vencimentos" subtitulo="O que vai sair do caixa nos próximos meses" />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Vence em 30 dias" valor={fmtBig(resumo.prox30 || 0)} tone="orange" sub="Próximo mês" />
        <KpiCard label="Vence em 90 dias" valor={fmtBig(resumo.prox90 || 0)} tone="neutral" sub="Próximo trimestre" />
        <KpiCard label="Em atraso (total)" valor={fmtBig(resumo.totalAtrasado || 0)} tone={resumo.totalAtrasado > 0 ? 'red' : 'green'} sub={`${resumo.qtdAtrasado || 0} título(s) vencido(s)`} />
        <KpiCard label="Total em aberto" valor={fmtBig(resumo.totalAberto || 0)} tone="neutral" sub={`${resumo.qtd || 0} parcela(s)`} />
      </div>
      <div className="mb-6">
        <Bloco titulo="Impacto no caixa — próximos 12 meses" sub="Soma das parcelas a vencer por mês">
          <BarRanking items={buckets.filter((b) => b.valor > 0)} colorFn={(_, i) => CORES_MES[i % CORES_MES.length]} mostrarQtd />
        </Bloco>
      </div>

      <div className="my-8 border-t border-gray-100" />

      {/* ===== BLOCO 3: COMPOSIÇÃO ===== */}
      <SectionHeader titulo="Para onde vai o que você deve" subtitulo="Composição de todas as contas a pagar em aberto" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Bloco titulo="Por categoria" sub="Contas a pagar em aberto por categoria">
          <BarRanking items={porCategoria} colorFn={() => '#D85A30'} mostrarQtd mostrarPct />
        </Bloco>
        <Bloco titulo="Maiores fornecedores / credores" sub="Quem você mais deve (em aberto)">
          <BarRanking items={porFornecedor} colorFn={() => '#0D2B55'} mostrarQtd mostrarPct />
        </Bloco>
      </div>

      <p className="mt-6 text-[11px] text-gray-400 leading-relaxed">
        Ao abrir, a tela mostra o último estado salvo no banco e, em paralelo, confere a Omie para incluir o que houver de novo — atualizando e regravando automaticamente.
        “Financiamentos de longo prazo” = séries com ≥ {CFG_FINANCIAMENTO_PADRAO.minParcelas} parcelas e parcela ≥ {fmtBig(CFG_FINANCIAMENTO_PADRAO.minValorParcela)} (ajustável).
        Valores baseados em títulos não liquidados.
      </p>
    </div>
  )
}
