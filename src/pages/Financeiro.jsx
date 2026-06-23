import { useState } from 'react'
import { useFinancas } from '../hooks/useFinancas.js'
import { useTitulosAberto } from '../hooks/useTitulosAberto.js'
import { useFaturamento } from '../hooks/useFaturamento.js'
import { useContratos } from '../hooks/useContratos.js'
import { useDRE } from '../hooks/useDRE.js'
import { useDREPeriodo } from '../hooks/useDREPeriodo.js'
import { useHistoricoFinancas } from '../hooks/useHistoricoFinancas.js'
import { useAutoFillSnapshots } from '../hooks/useAutoFillSnapshots.js'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import KpiCard from '../components/KpiCard.jsx'
import ProjecaoCaixa from '../components/ProjecaoCaixa.jsx'
import BarRanking from '../components/BarRanking.jsx'
import SeletorPeriodo, { PERIODOS } from '../components/SeletorPeriodo.jsx'
import GraficoEvolucao from '../components/GraficoEvolucao.jsx'
import AnalisePeriodo from '../components/AnalisePeriodo.jsx'
import PosicaoPonto from '../components/PosicaoPonto.jsx'
import EmpresaTabs from '../components/EmpresaTabs.jsx'
import ModoToggle from '../components/ModoToggle.jsx'
import FinanceiroSimples from './FinanceiroSimples.jsx'
import ResultadoHero from '../components/ResultadoHero.jsx'
import CascataResultado from '../components/CascataResultado.jsx'
import RoscaComposicao from '../components/RoscaComposicao.jsx'
import GaugeRadial from '../components/GaugeRadial.jsx'
import MiniBarraDivergente from '../components/MiniBarraDivergente.jsx'
import FaixaSaude from '../components/FaixaSaude.jsx'
import AgingEmpilhado from '../components/AgingEmpilhado.jsx'
import { IconeCaixa, IconeFaturamento, IconeRelogio, IconeDespesas, IconeResultado, IconeLiquida, IconeTendencia } from '../components/icones.jsx'
import { mergeDRE, MESES_ABREV, derivarCascata, serieTrend, classificarSaude } from '../utils/financeiro.js'
import { fmt, fmtBig, fmtPct } from '../utils/format.js'
import { isoNDiasAtras, isoParaBR, hojeISO } from '../utils/dates.js'
import { agruparPorCliente, agruparPorCategoria, bucketsAging, calcConcentracao, calcFolego } from '../utils/aggregators.js'

const CORES_AGING = ['#16a34a', '#EF9F27', '#D85A30', '#b45309', '#A32D2D']

function Skeleton({ h = 'h-40' }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${h}`} />
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

function DRELinha({ label, valor }) {
  const neg = valor < 0
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-gray-600">{label}</span>
      <span className={`tabular-nums font-medium ${neg ? 'text-red-600' : 'text-gray-800'}`}>
        {neg ? '−' : ''}{fmt(Math.abs(valor))}
      </span>
    </div>
  )
}

function Tile({ rotulo, valor, detalhe, cor = 'text-gray-900' }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className={`mt-0.5 text-lg font-bold ${cor}`}>{valor}</p>
      {detalhe && <p className="text-[11px] text-gray-400">{detalhe}</p>}
    </div>
  )
}

function SectionHeader({ titulo, subtitulo, Icone }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 h-5 w-[3px] shrink-0 rounded-full bg-[#F26522]" />
      <div className="flex items-start gap-2">
        {Icone && <Icone className="mt-0.5 h-5 w-5 shrink-0 text-[#0D2B55]" />}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#0D2B55]">{titulo}</h2>
          {subtitulo && <p className="text-[11px] text-gray-500 mt-0.5">{subtitulo}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Helpers de merge para o Consolidado ──────────────────────────────────────

// fluxoCaixa.vSaldo é saldo ACUMULADO (corrente) por dia; vReceber/vPagar são fluxos do dia.
// Eixo de datas unificado: saldos exigem forward-fill (carregar o último saldo conhecido de
// cada empresa nos dias em que ela não tem ponto), senão o saldo de uma empresa "some" nos
// dias só presentes na outra — criando um abismo falso na projeção consolidada.
function mergeFluxo(f1, f2) {
  const ord = (s) => { const [d, m, y] = String(s).split('/'); return Number(`${y}${m}${d}`) || 0 }
  const dias = [...new Set([...f1, ...f2].map((d) => d.dDia))].sort((a, b) => ord(a) - ord(b))
  const m1 = new Map(f1.map((d) => [d.dDia, d]))
  const m2 = new Map(f2.map((d) => [d.dDia, d]))
  let saldo1 = 0, saldo2 = 0
  return dias.map((dDia) => {
    const a = m1.get(dDia), b = m2.get(dDia)
    if (a) saldo1 = Number(a.vSaldo || 0)   // forward-fill: mantém o último saldo conhecido
    if (b) saldo2 = Number(b.vSaldo || 0)
    return {
      dDia,
      vReceber: Number(a?.vReceber || 0) + Number(b?.vReceber || 0),
      vPagar:   Number(a?.vPagar   || 0) + Number(b?.vPagar   || 0),
      vSaldo:   saldo1 + saldo2,
    }
  })
}

function mergeResumo(r1, r2) {
  const v = (obj, k) => Number((obj || {})[k] || 0)
  return {
    ...r1,
    dDia: r1.dDia || r2.dDia,
    contaCorrente: { vTotal: v(r1.contaCorrente, 'vTotal') + v(r2.contaCorrente, 'vTotal') },
    contaReceber: {
      vTotal:  v(r1.contaReceber, 'vTotal')  + v(r2.contaReceber, 'vTotal'),
      vAtraso: v(r1.contaReceber, 'vAtraso') + v(r2.contaReceber, 'vAtraso'),
      nTotal:  v(r1.contaReceber, 'nTotal')  + v(r2.contaReceber, 'nTotal'),
    },
    contaPagar: {
      vTotal:  v(r1.contaPagar, 'vTotal')  + v(r2.contaPagar, 'vTotal'),
      vAtraso: v(r1.contaPagar, 'vAtraso') + v(r2.contaPagar, 'vAtraso'),
      nTotal:  v(r1.contaPagar, 'nTotal')  + v(r2.contaPagar, 'nTotal'),
    },
    fluxoCaixa: mergeFluxo(r1.fluxoCaixa || [], r2.fluxoCaixa || []),
  }
}

// Snapshots são posições ABSOLUTAS por dia. Eixo de datas unificado + forward-fill:
// em dias que só uma empresa tem snapshot, mantém o último valor conhecido da outra
// (antes do 1º snapshot de uma empresa ela contribui 0 — ainda não existia). Sem isso,
// dias de cobertura parcial viram quedas/picos falsos na timeline consolidada.
function mergeHistorico(h1, h2) {
  const CAMPOS = ['caixa', 'a_receber', 'a_receber_atraso', 'a_receber_qtd', 'a_pagar', 'a_pagar_atraso', 'a_pagar_qtd']
  const dias = [...new Set([...h1, ...h2].map((r) => r.data))].sort((a, b) => a.localeCompare(b))
  const m1 = new Map(h1.map((r) => [r.data, r]))
  const m2 = new Map(h2.map((r) => [r.data, r]))
  let last1 = null, last2 = null
  return dias.map((data) => {
    if (m1.has(data)) last1 = m1.get(data)
    if (m2.has(data)) last2 = m2.get(data)
    const row = { data }
    for (const c of CAMPOS) row[c] = Number(last1?.[c] || 0) + Number(last2?.[c] || 0)
    return row
  })
}

function mergeListas(l1, l2) {
  if (!l1 && !l2) return null
  return [...(l1 || []), ...(l2 || [])]
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Financeiro() {
  const [empresa, setEmpresa] = useState('prn')
  const [periodo, setPeriodo] = useState('1m')
  const [refDate, setRefDate] = useState(null)
  const [metrica, setMetrica] = useState('caixa')
  const [modo, setModo]       = useState('simples')

  // Período calculado antes dos hooks para servir como dep dos novos hooks de faturamento
  const per       = PERIODOS.find((p) => p.key === periodo) || PERIODOS[4]
  const inicioISO = isoNDiasAtras(per.dias)
  const dataBR    = { inicio: isoParaBR(inicioISO), fim: isoParaBR(hojeISO()) }

  // Ambos os hooks rodam sempre; MedImagem aguarda PRN (serialização anti-425)
  const resumoPRN = useFinancas('prn')
  const resumoMed = useFinancas('medimagem', { enabled: !resumoPRN.loading })

  const titulosPRN = useTitulosAberto('prn', { enabled: !resumoPRN.loading && !resumoPRN.error })
  const titulosMed = useTitulosAberto('medimagem', { enabled: !resumoMed.loading && !resumoMed.error })

  // Faturamento de serviços (NFS-e) por período — serializado após titulos
  const fatPRN = useFaturamento('prn',       { enabled: !titulosPRN.loading, dataInicio: dataBR.inicio, dataFim: dataBR.fim })
  const fatMed = useFaturamento('medimagem', { enabled: !fatPRN.loading && !titulosMed.loading, dataInicio: dataBR.inicio, dataFim: dataBR.fim })

  // Contratos para MRR/ARR — usa cache se Contratos.jsx já carregou
  const ctrPRN = useContratos('prn',       { enabled: !fatPRN.loading })
  const ctrMed = useContratos('medimagem', { enabled: !fatMed.loading && !ctrPRN.loading })

  // DRE Realizado — mês corrente via /financas/caixa/ ListarOrcamentos
  const [hAno, hMes] = hojeISO().split('-').map(Number)
  const drePRN = useDRE('prn',       { enabled: !ctrPRN.loading, nAno: hAno, nMes: hMes })
  const dreMed = useDRE('medimagem', { enabled: !drePRN.loading && !ctrMed.loading, nAno: hAno, nMes: hMes })

  // DRE por período (visão Simples) — soma de meses calendário. Serializado após o DRE
  // do mês corrente; compartilha cache de mês com useDRE, então o caso ≤1 mês é grátis.
  const drePerPRN = useDREPeriodo('prn',       { enabled: !drePRN.loading && !dreMed.loading, periodo })
  const drePerMed = useDREPeriodo('medimagem', { enabled: !drePerPRN.loading && !dreMed.loading, periodo })

  const { historico: histPRN, loading: histLoadingPRN, refetch: refetchPRN } = useHistoricoFinancas('prn')
  const { historico: histMed, loading: histLoadingMed, refetch: refetchMed } = useHistoricoFinancas('medimagem')

  // Self-heal de lacunas por empresa. Gate em "histórico carregou" (não em qtd de linhas)
  // para que uma empresa nova (0 snapshots) também dispare o backfill. onConcluir → refetch
  // surfaceia as linhas recém-gravadas na timeline sem recarregar a página.
  useAutoFillSnapshots(
    !resumoPRN.loading && !resumoPRN.error && !titulosPRN.loading && !histLoadingPRN,
    (histPRN || []).map((r) => r.data),
    'prn',
    refetchPRN
  )
  useAutoFillSnapshots(
    !resumoMed.loading && !resumoMed.error && !titulosMed.loading && !histLoadingMed,
    (histMed || []).map((r) => r.data),
    'medimagem',
    refetchMed
  )

  // ── Derivar loading / error / retry baseado na empresa selecionada ──────────
  const isCons = empresa === 'consolidado'
  const isMed  = empresa === 'medimagem'

  const loading = isCons ? (resumoPRN.loading || resumoMed.loading)
                : isMed  ? resumoMed.loading
                :           resumoPRN.loading

  const error = isCons ? (resumoPRN.error || resumoMed.error)
              : isMed  ? resumoMed.error
              :           resumoPRN.error

  const retryAfter = isCons ? (resumoPRN.retryAfter ?? resumoMed.retryAfter)
                   : isMed  ? resumoMed.retryAfter
                   :           resumoPRN.retryAfter

  const retry = isCons ? () => { resumoPRN.retry(); resumoMed.retry() }
              : isMed  ? resumoMed.retry
              :           resumoPRN.retry

  if (loading) {
    return (
      <div className="flex-1 p-6">
        <div className="mb-5"><EmpresaTabs value={empresa} onChange={(e) => { setEmpresa(e); setRefDate(null) }} /></div>
        <LoadingSpinner message={`Carregando financeiro ${isCons ? '(PRN + MedImagem)' : empresa.toUpperCase()}...`} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 p-6">
        <div className="mb-5"><EmpresaTabs value={empresa} onChange={(e) => { setEmpresa(e); setRefDate(null) }} /></div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-sm font-semibold text-red-700">Erro ao carregar o financeiro</p>
          <p className="mt-2 text-xs text-red-500 max-w-md mx-auto">{error}</p>
          <div className="mt-4 flex items-center justify-center">
            {retryAfter !== null ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 ring-1 ring-orange-200">
                <span className="animate-pulse">⏱</span>
                Tentando novamente em <span className="tabular-nums font-bold">{retryAfter}s</span>
              </div>
            ) : (
              <button onClick={retry} className="inline-flex items-center gap-2 rounded-md bg-[#0D2B55] px-4 py-2 text-xs font-medium text-white hover:bg-blue-900 transition-colors">
                ↺ Tentar novamente
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Derivar dados conforme empresa selecionada ────────────────────────────
  let resumo, titulos, histAll

  if (isCons && resumoPRN.resumo && resumoMed.resumo) {
    resumo  = mergeResumo(resumoPRN.resumo, resumoMed.resumo)
    titulos = {
      loading:    titulosPRN.loading || titulosMed.loading,
      error:      titulosPRN.error   || titulosMed.error,
      receber:    mergeListas(titulosPRN.receber, titulosMed.receber),
      pagar:      mergeListas(titulosPRN.pagar,   titulosMed.pagar),
      retry:      () => { titulosPRN.retry(); titulosMed.retry() },
      retryAfter: titulosPRN.retryAfter ?? titulosMed.retryAfter,
    }
    histAll = mergeHistorico(histPRN || [], histMed || [])
  } else {
    resumo  = isMed ? resumoMed.resumo  : resumoPRN.resumo
    titulos = isMed ? titulosMed         : titulosPRN
    histAll = isMed ? (histMed || [])    : (histPRN || [])
  }

  // ===== Tier 1 — posição de HOJE (sempre live, ignora filtro/refDate) =====
  const cc = resumo.contaCorrente || {}, cr = resumo.contaReceber || {}, cp = resumo.contaPagar || {}
  const fluxo = resumo.fluxoCaixa || []
  const hoje = {
    caixa:         +(cc.vTotal  || 0), aReceber:      +(cr.vTotal  || 0), aPagar:        +(cp.vTotal  || 0),
    atrasoReceber: +(cr.vAtraso || 0), atrasoPagar:   +(cp.vAtraso || 0),
    qtdReceber:    +(cr.nTotal  || 0), qtdPagar:      +(cp.nTotal  || 0),
  }
  hoje.pctInad = hoje.aReceber > 0 ? (hoje.atrasoReceber / hoje.aReceber) * 100 : 0

  const projValida  = fluxo.length > 1 && fluxo.slice(1).some((d) => Number(d.vSaldo) !== 0 || Number(d.vReceber) !== 0 || Number(d.vPagar) !== 0)
  const saldoFinal  = fluxo.length ? Number(fluxo[fluxo.length - 1].vSaldo) : hoje.caixa
  const diaFinal    = fluxo.length ? fluxo[fluxo.length - 1].dDia : resumo.dDia
  const primeiroNeg = fluxo.find((d) => Number(d.vSaldo) < 0)
  const saldoNeg    = saldoFinal < 0
  const folego      = calcFolego(fluxo)
  const menorSaldoPt = fluxo.length ? fluxo.reduce((a, b) => (Number(b.vSaldo) < Number(a.vSaldo) ? b : a)) : null
  const entraFuturo  = fluxo.slice(1).reduce((s, d) => s + Number(d.vReceber || 0), 0)
  const saiFuturo    = fluxo.slice(1).reduce((s, d) => s + Number(d.vPagar   || 0), 0)
  const saldoEst     = hoje.caixa + hoje.aReceber - hoje.aPagar
  const ativoCorrente   = hoje.caixa + hoje.aReceber
  const passivoCorrente = hoje.aPagar
  const capitalGiro     = ativoCorrente - passivoCorrente
  const liquidez        = passivoCorrente > 0 ? ativoCorrente / passivoCorrente : null

  const recAb = titulos.receber
  const pagAb = titulos.pagar
  const conc  = recAb ? calcConcentracao(recAb) : null

  // ── Faturamento de serviços (NFS-e) por período ──────────────────────────────
  const fat        = isMed ? fatMed : fatPRN
  const fatLoading = isCons ? (fatPRN.loading || fatMed.loading) : fat.loading
  const fatError   = isCons ? (fatPRN.error   || fatMed.error)   : fat.error

  const getNfse = (f) => f?.faturamento?.painel?.faturamentoNFSe || {}
  const nfsePRN = getNfse(fatPRN), nfseMed = getNfse(fatMed), nfse = isCons ? null : getNfse(fat)
  const vFaturadas  = isCons ? +(nfsePRN.vFaturadas||0)  + +(nfseMed.vFaturadas||0)  : +(nfse?.vFaturadas||0)
  const nFaturadas  = isCons ? +(nfsePRN.nFaturadas||0)  + +(nfseMed.nFaturadas||0)  : +(nfse?.nFaturadas||0)
  const vCanceladas = isCons ? +(nfsePRN.vCanceladas||0) + +(nfseMed.vCanceladas||0) : +(nfse?.vCanceladas||0)
  const nCanceladas = isCons ? +(nfsePRN.nCanceladas||0) + +(nfseMed.nCanceladas||0) : +(nfse?.nCanceladas||0)
  const vPendentes  = isCons ? +(nfsePRN.vPendentes||0)  + +(nfseMed.vPendentes||0)  : +(nfse?.vPendentes||0)
  const nOsEmAberto = +(fatPRN.faturamento?.ordemServico?.emAberto?.nTotal||0)
                    + (isCons ? +(fatMed.faturamento?.ordemServico?.emAberto?.nTotal||0) : 0)

  // ── MRR / ARR (contratos ativos normalizados para mensal) ────────────────────
  const FAT_DIV = { '01': 1, '02': 2, '03': 3, '04': 6, '05': 12 }
  const toMensal = (c) => Number(c.nValTotMes) / (FAT_DIV[c.cTipoFat] || 1)

  const ctrAtivosPRN = (ctrPRN.contratos || []).filter((c) => c.cCodSit === '90')
  const ctrAtivosMed = (ctrMed.contratos || []).filter((c) => c.cCodSit === '90')
  const ctrAtivos = isCons ? [...ctrAtivosPRN, ...ctrAtivosMed]
                  : isMed  ? ctrAtivosMed
                  :           ctrAtivosPRN

  const ctrLoading = isCons ? (ctrPRN.loading || ctrMed.loading) : isMed ? ctrMed.loading : ctrPRN.loading
  const mrr = ctrAtivos.reduce((s, c) => s + toMensal(c), 0)
  const arr = mrr * 12
  const clientesUnicos = new Set(ctrAtivos.map((c) => c.nomeCliente)).size
  const ticketMedio    = clientesUnicos > 0 ? mrr / clientesUnicos : null

  const ctrRisco90 = ctrAtivos.filter((c) => c.diasRestantes != null && c.diasRestantes <= 90)
  const arrRisco   = ctrRisco90.reduce((s, c) => s + toMensal(c) * 12, 0)

  // ── Burn Rate + Runway (histórico Supabase) ──────────────────────────────────
  const hoje30 = histAll.find((r) => {
    const diffDias = Math.round((new Date(hojeISO()) - new Date(r.data)) / 86400000)
    return diffDias >= 25 && diffDias <= 35
  })
  const caixa30dAtras = hoje30 ? Number(hoje30.caixa || 0) : null
  const burnDia       = caixa30dAtras != null ? (caixa30dAtras - hoje.caixa) / 30 : null
  const runway        = burnDia != null && burnDia > 0 ? Math.round(hoje.caixa / burnDia) : null

  // ── PMR / Atraso médio (de títulos em aberto) ────────────────────────────────
  const calcAtrasoMedio = (lista) => {
    if (!lista || lista.length === 0) return null
    const totalVal  = lista.reduce((s, t) => s + Number(t.vDoc || 0), 0)
    const totalPond = lista.reduce((s, t) => s + Number(t.nDiasAtraso || 0) * Number(t.vDoc || 0), 0)
    return totalVal > 0 ? Math.round(totalPond / totalVal) : null
  }
  const atrasoMedioReceber = calcAtrasoMedio(recAb)
  const atrasoMedioPagar   = calcAtrasoMedio(pagAb)
  // PMR formal: (A Receber / ARR) × 365 — usa ARR dos contratos como proxy de faturamento anual
  const pmr  = arr > 0 ? Math.round((hoje.aReceber / arr) * 365) : atrasoMedioReceber
  const ciclo = pmr != null && atrasoMedioPagar != null ? pmr - atrasoMedioPagar : null

  // ── DRE Realizado (mês corrente) ────────────────────────────────────────────
  const dreLoading = isCons ? (drePRN.loading || dreMed.loading) : isMed ? dreMed.loading : drePRN.loading
  const dreError   = isCons ? (drePRN.error   || dreMed.error)   : isMed ? dreMed.error   : drePRN.error
  const dreData    = isCons ? mergeDRE(drePRN.dre, dreMed.dre) : isMed ? dreMed.dre : drePRN.dre

  // ── DRE por período para a visão Simples ────────────────────────────────────
  const drePeriodo = isCons
    ? {
        dre:          mergeDRE(drePerPRN.dre, drePerMed.dre),
        loading:      drePerPRN.loading || drePerMed.loading,
        error:        drePerPRN.error   || drePerMed.error,
        retryAfter:   drePerPRN.retryAfter ?? drePerMed.retryAfter,
        retry:        () => { drePerPRN.retry(); drePerMed.retry() },
        rotulo:       drePerPRN.rotulo,
        periodoFrase: drePerPRN.periodoFrase,
        ehMesVigente: drePerPRN.ehMesVigente,
        capeado1a:    drePerPRN.capeado1a,
      }
    : isMed ? drePerMed : drePerPRN

  // ===== Tier 2 — análise da linha do tempo (segue período + ponto) =====
  // per + inicioISO já calculados no topo do componente (antes dos hooks)
  const janela     = histAll.filter((r) => r.data >= inicioISO)
  const refRow     = refDate ? histAll.find((r) => r.data === refDate) : null
  const pontoRow   = refRow || (janela.length ? janela[0] : null)
  const pontoData  = refRow ? refDate : (janela.length ? janela[0].data : null)
  const intervalo  = per.dias === 0 ? isoParaBR(hojeISO()) : `${isoParaBR(inicioISO)} → ${isoParaBR(hojeISO())}`

  const empresaLabel = isCons ? 'Consolidado (PRN + MedImagem)' : isMed ? 'MedImagem' : 'PRN'

  // ── Derivados do redesign Avançado ──────────────────────────────────────────
  // Tendência + sparkline (sem nova API) a partir do histórico. Devolve props p/ KpiCard.
  const tendencia = (campo, valorHoje, bomQuando, cor) => {
    const t = serieTrend(histAll, campo, valorHoje)
    return {
      trend: t && t.delta != null ? { delta: t.delta, pct: t.pct, bomQuando, label: 'vs ~30 dias' } : null,
      sparkData: t?.sparkData || null,
      sparkColor: cor,
    }
  }
  const sinaisSaude = classificarSaude({
    caixa: hoje.caixa, liquidez, runway, burnDia, pctInad: hoje.pctInad,
    atrasoPagar: hoje.atrasoPagar, primeiroNeg, projValida,
  })
  const cascataAv  = derivarCascata(drePeriodo.dre)
  const subtituloDRE = drePeriodo.ehMesVigente
    ? 'Resultado do mês inteiro — o DRE é fechado por mês, não por dia.'
    : drePeriodo.capeado1a
      ? 'Soma dos meses fechados — janela de até 6 meses.'
      : 'Soma dos meses fechados no período.'

  return (
    <div className="flex-1 p-6 overflow-auto">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="mt-1 text-sm text-gray-500">{empresaLabel} — dados Omie</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <ModoToggle valor={modo} onChange={setModo} />
            <EmpresaTabs value={empresa} onChange={(e) => { setEmpresa(e); setRefDate(null) }} />
          </div>
          <span className="text-xs text-gray-400">🕐 Atualizado em {resumo.dDia}</span>
        </div>
      </div>

      {modo === 'simples' ? (
        <FinanceiroSimples
          periodo={periodo}
          setPeriodo={(k) => { setPeriodo(k); setRefDate(null) }}
          drePeriodo={drePeriodo}
          caixaHoje={hoje.caixa}
          faturamento={{ vFaturadas, nFaturadas, vCanceladas, nCanceladas, vPendentes, loading: fatLoading, error: fatError, intervalo }}
        />
      ) : (
      <>

      {/* Faixa de veredito de saúde (null-safe) + seletor de período no topo */}
      <FaixaSaude sinais={sinaisSaude} />

      <div className="mt-4 mb-6">
        <SeletorPeriodo valor={periodo} onChange={(k) => { setPeriodo(k); setRefDate(null) }} />
      </div>

      {/* ===== BLOCO 1: CAIXA E LIQUIDEZ ===== */}
      <SectionHeader titulo="Caixa e Liquidez" Icone={IconeCaixa} subtitulo="Posição ao vivo — saldos, projeção e saúde financeira de curto prazo" />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KpiCard label="Dinheiro em caixa hoje" valor={fmtBig(hoje.caixa)} tone="neutral" big sub="Saldo somado das contas correntes"
          {...tendencia('caixa', hoje.caixa, 'subir', '#0D2B55')} />
        {projValida ? (
          <KpiCard label={`Saldo projetado em ${diaFinal}`} valor={fmtBig(saldoFinal)} tone={saldoNeg ? 'red' : 'green'} big sub={`Projeção da Omie para os próximos ${fluxo.length} dias`} />
        ) : hoje.caixa != null ? (
          <KpiCard label="Saldo líquido estimado" valor={fmtBig(saldoEst)} tone={saldoEst < 0 ? 'red' : 'green'} big sub="Caixa + recebíveis − pagáveis em aberto (sem datas futuras na Omie)" />
        ) : (
          <KpiCard label="Saldo projetado" valor="Indisponível" tone="neutral" big sub="Projeção da Omie não retornou desta vez — recarregue" />
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="A receber (em aberto)" valor={fmt(hoje.aReceber)} sub={`${hoje.qtdReceber} título${hoje.qtdReceber !== 1 ? 's' : ''}`} tone="green"
          {...tendencia('a_receber', hoje.aReceber, null, '#639922')} />
        <KpiCard label="A pagar (em aberto)" valor={fmt(hoje.aPagar)} sub={`${hoje.qtdPagar} título${hoje.qtdPagar !== 1 ? 's' : ''}`} tone="orange"
          {...tendencia('a_pagar', hoje.aPagar, 'cair', '#D85A30')} />
        <KpiCard label="% a receber em atraso" valor={fmtPct(hoje.pctInad)} sub="Inadimplência"
          tone={hoje.pctInad < 10 ? 'green' : hoje.pctInad < 25 ? 'orange' : 'red'}
          status={hoje.pctInad < 10 ? 'bom' : hoje.pctInad < 25 ? 'atencao' : 'ruim'}
          {...tendencia((r) => { const ar = Number(r.a_receber || 0); return ar > 0 ? (Number(r.a_receber_atraso || 0) / ar) * 100 : 0 }, hoje.pctInad, 'cair', '#A32D2D')} />
        <KpiCard label="Em atraso a pagar" valor={fmt(hoje.atrasoPagar)} sub="Contas vencidas não pagas"
          tone={hoje.atrasoPagar > 0 ? 'red' : 'green'} status={hoje.atrasoPagar > 0 ? 'ruim' : 'bom'} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GaugeRadial
          rotulo="Liquidez corrente" Icone={IconeLiquida}
          valor={liquidez} min={0} max={3}
          zonas={[{ ate: 1, cor: '#A32D2D' }, { ate: 1.5, cor: '#EF9F27' }, { ate: Infinity, cor: '#16a34a' }]}
          formatar={(v) => v.toFixed(2)} unidadeSub="Ativo ÷ Passivo"
          frase={liquidez == null ? 'Sem dívidas de curto prazo — não se aplica.' : liquidez >= 1.5 ? 'Folga: ativos cobrem bem as dívidas de curto prazo.' : liquidez >= 1 ? 'No limite: cobre as dívidas, com pouca folga.' : 'Aperto: as dívidas de curto prazo superam os recebíveis.'}
        />
        <KpiCard label="Ativo corrente"   valor={fmtBig(ativoCorrente)}   tone="neutral" sub="Caixa + títulos a receber" />
        <KpiCard label="Passivo corrente" valor={fmtBig(passivoCorrente)} tone="neutral" sub="Títulos a pagar em aberto" />
        <KpiCard label="Capital de giro"  valor={fmtBig(capitalGiro)}     tone={capitalGiro >= 0 ? 'green' : 'red'} status={capitalGiro >= 0 ? 'bom' : 'ruim'} sub="Ativo − Passivo corrente" />
      </div>
      <p className="mb-4 text-[11px] text-gray-500">⚠ Baseado em títulos em aberto (não liquidados) — não reflete transações realizadas no período.</p>

      {/* Projeção de caixa */}
      <div className="mb-6">
        <Bloco titulo="Para onde vai o seu caixa" sub={projValida ? `Projeção de saldo da Omie — próximos ${fluxo.length} dias` : 'Projeção de saldo da Omie'}>
          {projValida ? (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Tile rotulo="Menor saldo projetado" valor={fmtBig(menorSaldoPt.vSaldo)} detalhe={`em ${menorSaldoPt.dDia.slice(0, 5)}`} cor={Number(menorSaldoPt.vSaldo) < 0 ? 'text-red-700' : 'text-gray-900'} />
                <Tile rotulo="Caixa zera em" valor={folego.dia ? folego.dia.slice(0, 5) : '—'} detalhe={folego.dia ? `em ${folego.dias} dia${folego.dias !== 1 ? 's' : ''}` : 'não zera nos próximos dias'} cor={folego.dia ? 'text-red-700' : 'text-green-700'} />
                <Tile rotulo="Entra (próx. dias)" valor={fmtBig(entraFuturo)} detalhe="exclui vencidos de hoje" cor="text-green-700" />
                <Tile rotulo="Sai (próx. dias)" valor={fmtBig(saiFuturo)} detalhe="compromissos a vencer" cor="text-orange-700" />
              </div>
              <ProjecaoCaixa fluxo={fluxo} />
            </>
          ) : (
            <p className="py-6 text-center text-sm text-gray-400">A projeção da Omie não retornou dados desta vez. Recarregue a página para tentar novamente.</p>
          )}
        </Bloco>
      </div>

      <div className="my-8 border-t border-gray-100" />

      {/* ===== BLOCO 2: RECEITA E RESULTADO (DRE segue o período) ===== */}
      <SectionHeader titulo="Receita e Resultado" Icone={IconeFaturamento} subtitulo={drePeriodo.rotulo} />

      {ctrLoading ? (
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0,1,2,3].map(i => <Skeleton key={i} h="h-[92px]" />)}
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="MRR" valor={fmtBig(mrr)} tone="green" icon={IconeFaturamento} status={mrr > 0 ? 'bom' : null} sub={`${ctrAtivos.length} contrato${ctrAtivos.length !== 1 ? 's' : ''} ativo${ctrAtivos.length !== 1 ? 's' : ''}`} />
          <KpiCard label="ARR" valor={fmtBig(arr)} tone="green" icon={IconeResultado} sub="Receita anual recorrente projetada" />
          <KpiCard label="Ticket médio" valor={ticketMedio != null ? fmtBig(ticketMedio) : '—'} tone="neutral" icon={IconeLiquida} sub={`${clientesUnicos} cliente${clientesUnicos !== 1 ? 's' : ''} ativo${clientesUnicos !== 1 ? 's' : ''}`} />
          <KpiCard label="ARR em risco" valor={fmtBig(arrRisco)} tone={arrRisco > 0 ? 'red' : 'neutral'} icon={IconeRelogio} status={arrRisco > 0 ? 'atencao' : 'bom'} sub={`${ctrRisco90.length} contrato${ctrRisco90.length !== 1 ? 's' : ''} vence${ctrRisco90.length !== 1 ? 'm' : ''} em ≤90d`} />
        </div>
      )}

      {drePeriodo.loading ? (
        <div className="mb-6 space-y-4">
          <Skeleton h="h-[92px]" />
          <Skeleton h="h-80" />
        </div>
      ) : drePeriodo.error && drePeriodo.retryAfter !== null ? (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
          <span className="animate-pulse">⏱</span> Muitas consultas seguidas — tentando novamente em <span className="tabular-nums font-bold">{drePeriodo.retryAfter}s</span>
        </div>
      ) : drePeriodo.error ? (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Não foi possível carregar o resultado: {drePeriodo.error}</p>
          <button onClick={drePeriodo.retry} className="shrink-0 rounded-md bg-[#0D2B55] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-900 transition-colors">↺ Tentar de novo</button>
        </div>
      ) : (
        <div className="mb-6 space-y-4">
          <ResultadoHero dre={drePeriodo.dre} periodoFrase={drePeriodo.periodoFrase} ehMesVigente={drePeriodo.ehMesVigente} />
          {cascataAv && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CascataResultado cascata={cascataAv} titulo={drePeriodo.rotulo} subtitulo={subtituloDRE} />
              <RoscaComposicao cascata={cascataAv} />
            </div>
          )}
        </div>
      )}

      <div className="my-8 border-t border-gray-100" />

      {/* ===== BLOCO 3: EFICIÊNCIA OPERACIONAL ===== */}
      <SectionHeader titulo="Eficiência Operacional" Icone={IconeRelogio} subtitulo="Velocidade de consumo de caixa, prazo de recebimento e ciclo financeiro" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={burnDia != null && burnDia <= 0 ? 'Ganho diário' : 'Queima diária'} icon={IconeCaixa}
          valor={burnDia != null ? fmtBig(Math.abs(burnDia)) : '—'}
          tone={burnDia == null ? 'neutral' : burnDia <= 0 ? 'green' : 'red'}
          sub={burnDia == null ? 'Aguardando 30d de histórico' : burnDia <= 0 ? 'Caixa cresce por dia (últ. 30d)' : 'Caixa perde por dia (últ. 30d)'}
          {...tendencia('caixa', hoje.caixa, 'subir', burnDia != null && burnDia > 0 ? '#A32D2D' : '#16a34a')} />
        <GaugeRadial
          rotulo="Fôlego de caixa" Icone={IconeRelogio}
          valor={runway} min={0} max={365}
          zonas={[{ ate: 90, cor: '#A32D2D' }, { ate: 180, cor: '#EF9F27' }, { ate: Infinity, cor: '#16a34a' }]}
          formatar={(v) => `${Math.round(v / 30)} ${Math.round(v / 30) === 1 ? 'mês' : 'meses'}`}
          valorTexto={runway == null && burnDia != null && burnDia <= 0 ? '∞' : undefined}
          corForcada={runway == null && burnDia != null && burnDia <= 0 ? '#16a34a' : undefined}
          unidadeSub="no ritmo atual"
          frase={runway != null ? `O caixa dura ~${runway} dias sem entradas novas.` : (burnDia != null && burnDia <= 0 ? 'Caixa em crescimento — sem queima a projetar.' : 'Aguardando 30 dias de histórico.')}
        />
        <GaugeRadial
          rotulo="Prazo de recebimento" Icone={IconeRelogio}
          valor={pmr} min={0} max={120}
          zonas={[{ ate: 30, cor: '#16a34a' }, { ate: 60, cor: '#EF9F27' }, { ate: Infinity, cor: '#A32D2D' }]}
          formatar={(v) => `${v}d`} unidadeSub="dias até receber"
          frase={pmr == null ? 'Sem recebíveis para calcular.' : (arr > 0 ? `Leva ~${pmr} dias entre faturar e receber.` : `Atraso médio dos recebíveis em aberto: ~${pmr} dias.`)}
        />
        <MiniBarraDivergente
          rotulo="Ciclo financeiro" Icone={IconeRelogio}
          valor={ciclo} escala={60}
          frase={ciclo == null ? 'Disponível quando os títulos a pagar carregarem.' : ciclo < 0 ? `Recebe ~${Math.abs(ciclo)} dias antes de pagar — a operação se financia.` : `Financia a operação por ~${ciclo} dias.`}
        />
      </div>

      {/* A receber × A pagar */}
      <div className="mb-6">
        <Bloco titulo="A receber × A pagar" sub="Posição atual — o que têm a te pagar vs o que você deve">
          <BarRanking items={[{ nome: 'A receber', valor: hoje.aReceber }, { nome: 'A pagar', valor: hoje.aPagar }]} colorFn={(_, i) => (i === 0 ? '#16a34a' : '#EF9F27')} />
          <p className="mt-3 text-xs text-gray-500">
            Saldo líquido em aberto: <span className="font-semibold text-gray-700">{fmt(hoje.aReceber - hoje.aPagar)}</span>
            {hoje.pctInad >= 50 && <span className="text-red-600"> — porém {fmtPct(hoje.pctInad)} do que há a receber está em atraso</span>}
          </p>
        </Bloco>
      </div>

      <div className="my-8 border-t border-gray-100" />

      {/* ===== BLOCO 4: ANÁLISE DE CRÉDITO ===== */}
      <SectionHeader titulo="Análise de Crédito" Icone={IconeDespesas} subtitulo="Concentração de devedores, tempo de atraso e composição do que você deve" />

      {titulos.loading ? (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton />
          <Skeleton />
        </div>
      ) : titulos.error ? (
        <p className="mb-6 text-xs text-red-500">Não foi possível carregar os títulos: {titulos.error}</p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Bloco titulo="Maiores devedores" sub={conc ? `${conc.top1Nome} concentra ${fmtPct(conc.pctTop1)} do total a receber` : null}>
              <BarRanking items={agruparPorCliente(recAb, 5)} colorFn={() => '#A32D2D'} mostrarPct />
            </Bloco>
            <Bloco titulo="Atraso por tempo (aging)" sub="Há quanto tempo os recebíveis estão vencidos">
              <AgingEmpilhado buckets={bucketsAging(recAb)} cores={CORES_AGING} />
            </Bloco>
          </div>
          <div className="mb-6">
            <Bloco titulo="Para onde vai o que você deve" sub="Despesas em aberto por categoria">
              <BarRanking items={agruparPorCategoria(pagAb, 6)} colorFn={() => '#D85A30'} mostrarPct />
            </Bloco>
          </div>
        </>
      )}

      <div className="my-8 border-t border-gray-100" />

      {/* ===== BLOCO 5: LINHA DO TEMPO (Tier 2 — segue período) ===== */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="mt-1 h-5 w-[3px] shrink-0 rounded-full bg-[#0D2B55]" />
            <div className="flex items-start gap-2">
              <IconeTendencia className="mt-0.5 h-5 w-5 shrink-0 text-[#0D2B55]" />
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-[#0D2B55]">Linha do Tempo</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">Como evoluiu no período: {intervalo}</p>
              </div>
            </div>
          </div>
          {refRow && (
            <button onClick={() => setRefDate(null)} className="shrink-0 rounded-md bg-[#0D2B55] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-900 transition-colors">
              Limpar seleção
            </button>
          )}
        </div>

        <SeletorPeriodo valor={periodo} onChange={(k) => { setPeriodo(k); setRefDate(null) }} />

        {/* Faturamento de serviços do período selecionado */}
        <div className="mt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Faturamento de serviços — {intervalo}</p>
          {fatLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0,1,2,3].map(i => <Skeleton key={i} h="h-[88px]" />)}
            </div>
          ) : fatError ? (
            <p className="text-xs text-red-500">Faturamento indisponível: {fatError}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <KpiCard label="Receita faturada"        valor={fmtBig(vFaturadas)}  tone="green"   icon={IconeFaturamento}
                  sub={`${nFaturadas} NFS-e emitida${nFaturadas !== 1 ? 's' : ''} no período`} />
                <KpiCard label="Pendente de recebimento" valor={fmtBig(vPendentes)}  tone="neutral" icon={IconeRelogio}
                  sub="NFS-e aguardando pagamento" />
                <KpiCard label="Cancelamentos"           valor={fmtBig(vCanceladas)} tone={vCanceladas > 0 ? 'red' : 'neutral'} icon={IconeDespesas}
                  sub={`${nCanceladas} NFS-e cancelada${nCanceladas !== 1 ? 's' : ''}`} />
                <KpiCard label="OS em aberto"            valor={String(nOsEmAberto)} tone="neutral" icon={IconeCaixa}
                  sub="Ordens de serviço não faturadas" />
              </div>
              <p className="mt-2 text-[11px] text-gray-500">
                NFS-e emitidas no período — faturamento bruto, não confundir com recebimento efetivo em caixa.
              </p>
            </>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <GraficoEvolucao
            data={janela}
            metrica={metrica}
            onMetricaChange={setMetrica}
            refDate={refDate}
            onPickDate={(iso) => setRefDate(iso === hojeISO() ? null : iso)}
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Análise do período</p>
          <AnalisePeriodo janela={janela} metrica={metrica} />
        </div>

        {pontoRow && (
          <div className="mt-5 border-t border-gray-200 pt-4">
            <PosicaoPonto pontoRow={pontoRow} hoje={hoje} data={pontoData} ehClique={!!refRow} />
          </div>
        )}
      </div>

      </>
      )}
    </div>
  )
}
