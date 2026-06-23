import { useState, useMemo } from 'react'
import { useOrdensServico } from '../hooks/useOrdensServico.js'
import { useFaturamento } from '../hooks/useFaturamento.js'
import { fmt } from '../utils/format.js'
import EmpresaTabs from '../components/EmpresaTabs.jsx'
import ModoToggle from '../components/ModoToggle.jsx'
import KpiCard from '../components/KpiCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import SeletorPeriodo, { PERIODOS } from '../components/SeletorPeriodo.jsx'

// ─── utilitários ────────────────────────────────────────────────────────────

function calcDatasOmie(periodo) {
  const p    = PERIODOS.find((x) => x.key === periodo)
  const dias = p?.dias ?? 30
  const pad  = (n) => String(n).padStart(2, '0')
  const fmt_ = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  const fim  = new Date()
  const ini  = new Date()
  if (dias > 0) ini.setDate(ini.getDate() - dias)
  ini.setHours(0, 0, 0, 0)
  return { dataInicio: fmt_(ini), dataFim: fmt_(fim) }
}

// helpers Fonte 1
const getNfse = (rawData) => rawData?.faturamento?.painel?.faturamentoNFSe ?? {}
const getOS   = (rawData) => rawData?.faturamento?.ordemServico?.emAberto   ?? {}

// ─── status OS ──────────────────────────────────────────────────────────────

const STATUS_MAP = {
  PLA: { legivel: 'Aberta',               cls: 'bg-blue-100   text-blue-700   ring-blue-200',   cor: '#3B82F6' },
  CON: { legivel: 'Em Andamento',         cls: 'bg-blue-100   text-blue-800   ring-blue-200',   cor: '#1D4ED8' },
  EXE: { legivel: 'Aguardando Aprovação', cls: 'bg-amber-100  text-amber-800  ring-amber-200',  cor: '#D97706' },
  AOF: { legivel: 'Pronta p/ Faturar',   cls: 'bg-orange-100 text-orange-700 ring-orange-200', cor: '#F26522' },
  FEF: { legivel: 'Faturada',            cls: 'bg-green-100  text-green-700  ring-green-200',  cor: '#16A34A' },
  CAC: { legivel: 'Cancelada',           cls: 'bg-gray-100   text-gray-500   ring-gray-200',   cor: '#9CA3AF' },
}
const STATUS_ABERTO = ['PLA', 'CON', 'EXE', 'AOF']

const FILTROS_STATUS = [
  { key: 'todos',  label: 'Todos'              },
  { key: 'aberto', label: 'Em Aberto'          },
  { key: 'AOF',    label: 'Prontas p/ Faturar' },
  { key: 'FEF',    label: 'Faturadas'          },
  { key: 'CAC',    label: 'Canceladas'         },
]

// ─── sub-componentes ────────────────────────────────────────────────────────

function StatusBadgeOS({ status }) {
  const cfg = STATUS_MAP[status] ?? { legivel: status || '—', cls: 'bg-yellow-100 text-yellow-800 ring-yellow-200' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.cls}`}>
      {cfg.legivel}
    </span>
  )
}

function AlertaAtraso({ atrasada, dPrevisao }) {
  if (!atrasada) return null
  return (
    <span title={`Previsão era ${dPrevisao}`}
      className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
      ⚠ Atrasada
    </span>
  )
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1 text-blue-600">{dir === 'asc' ? '↑' : '↓'}</span>
}

function Th({ label, k, sortKey, sortDir, onSort }) {
  return (
    <th onClick={() => onSort(k)}
      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-100">
      {label}<SortIcon active={sortKey === k} dir={sortDir} />
    </th>
  )
}

function EmpresaBadge({ empresa }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      empresa === 'PRN' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
    }`}>{empresa}</span>
  )
}

function ErrorCard({ error, retryAfter, retry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <p className="text-sm font-semibold text-red-700">Erro ao carregar ordens de serviço</p>
      <p className="mt-2 text-xs text-red-500 max-w-md mx-auto">{error}</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        {retryAfter !== null ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 ring-1 ring-orange-200">
            <span className="animate-pulse">⏱</span>
            Tentando novamente em <span className="tabular-nums font-bold">{retryAfter}s</span>
          </div>
        ) : (
          <button onClick={retry}
            className="inline-flex items-center gap-2 rounded-md bg-[#0D2B55] px-4 py-2 text-xs font-medium text-white hover:bg-blue-900 transition-colors">
            ↺ Tentar novamente
          </button>
        )}
      </div>
    </div>
  )
}

// Donut SVG puro — distribuição de OS por status
function DonutStatus({ data }) {
  const R = 54; const C = 2 * Math.PI * R; const STROKE = 15
  const total = data.reduce((s, d) => s + d.valor, 0)
  if (total === 0) return <p className="text-sm text-gray-400 py-8 text-center">Sem OS no período</p>
  let acc = 0
  const arcs = data.map((seg) => { const len = (seg.valor / total) * C; const arc = { ...seg, len, offset: -acc }; acc += len; return arc })
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-32 w-32" aria-hidden="true">
          <g transform="rotate(-90 60 60)" fill="none" strokeWidth={STROKE}>
            <circle cx="60" cy="60" r={R} stroke="#F1EFE8" />
            {arcs.map((a, i) => a.len > 0.5 && (
              <circle key={i} cx="60" cy="60" r={R} stroke={a.cor}
                strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={a.offset} />
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-xl font-bold text-gray-900">{total}</span>
          <span className="text-[10px] text-gray-400 leading-tight">OS no período</span>
        </div>
      </div>
      <div className="flex-1 min-w-[160px] space-y-1.5 text-sm">
        {data.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: seg.cor }} />
            <span className="flex-1 text-gray-600">{seg.label}</span>
            <span className="font-semibold tabular-nums text-gray-700">{seg.valor}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Barras horizontais — top clientes
function BarRankingClientes({ data, maxVal }) {
  if (!data || data.length === 0) return <p className="text-sm text-gray-400 py-8 text-center">Nenhuma OS em aberto no período</p>
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={item.nome} className="flex items-center gap-3 text-sm">
          <span className="w-4 text-right text-xs font-bold text-gray-400 shrink-0">{i + 1}</span>
          <span className="w-36 truncate text-xs text-gray-700 shrink-0" title={item.nome}>{item.nome}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full bg-[#F26522] transition-all"
              style={{ width: `${maxVal > 0 ? Math.round((item.valor / maxVal) * 100) : 0}%` }} />
          </div>
          <span className="text-xs font-semibold text-gray-600 tabular-nums shrink-0 text-right w-24">{fmt(item.valor)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── ordenação tabela ────────────────────────────────────────────────────────

function sortOS(list, key, dir) {
  return [...list].sort((a, b) => {
    let va = a[key] ?? '', vb = b[key] ?? ''
    if (key === 'nValorTotal') return dir === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va)
    if (key === 'dDataOS' || key === 'dPrevisao') {
      const toNum = (d) => { const p = String(d).split('/'); return Number(`${p[2]??0}${p[1]??0}${p[0]??0}`) || 0 }
      return dir === 'asc' ? toNum(va) - toNum(vb) : toNum(vb) - toNum(va)
    }
    const cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
    return dir === 'asc' ? cmp : -cmp
  })
}

// ─── página ─────────────────────────────────────────────────────────────────

export default function OrdemServico() {
  const [empresa, setEmpresa]             = useState('prn')
  const [modo, setModo]                   = useState('simples')
  const [periodo, setPeriodo]             = useState('1m')
  const [busca, setBusca]                 = useState('')
  const [filtroStatus, setFiltroStatus]   = useState('todos')
  const [sortKey, setSortKey]             = useState('nValorTotal')
  const [sortDir, setSortDir]             = useState('desc')

  const { dataInicio, dataFim } = calcDatasOmie(periodo)

  // ── Fonte 1: ObterResumoServicos — carrega em ~1s, sempre confiável ───────
  // Serializado para evitar rate-limit 425 (PRN primeiro, MedImagem aguarda)
  const fat1PRN = useFaturamento('prn',       { dataInicio, dataFim })
  const fat1Med = useFaturamento('medimagem', { enabled: !fat1PRN.loading, dataInicio, dataFim })

  // ── Fonte 2: ListarOS filtrado pelo período — tabela + KPIs derivados ─────
  const prn = useOrdensServico('prn',       { enabled: !fat1Med.loading, periodo })
  const med = useOrdensServico('medimagem', { enabled: !prn.loading,     periodo })

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  // ── Seletores de empresa ─────────────────────────────────────────────────
  const isCons = empresa === 'consolidado'
  const isMed  = empresa === 'medimagem'

  // ── KPIs Fonte 1 ─────────────────────────────────────────────────────────
  const nfsePRN   = getNfse(fat1PRN)
  const nfseMed   = getNfse(fat1Med)
  const nfse      = isCons ? null : isMed ? nfseMed : nfsePRN

  const nOsEmAberto = isCons
    ? +(getOS(fat1PRN).nTotal || 0) + +(getOS(fat1Med).nTotal || 0)
    : isMed
    ? +(getOS(fat1Med).nTotal || 0)
    : +(getOS(fat1PRN).nTotal || 0)

  const vFaturadas  = isCons ? +(nfsePRN.vFaturadas  || 0) + +(nfseMed.vFaturadas  || 0) : +(nfse?.vFaturadas  || 0)
  const nFaturadas  = isCons ? +(nfsePRN.nFaturadas  || 0) + +(nfseMed.nFaturadas  || 0) : +(nfse?.nFaturadas  || 0)
  const vPendentes  = isCons ? +(nfsePRN.vPendentes  || 0) + +(nfseMed.vPendentes  || 0) : +(nfse?.vPendentes  || 0)
  const vCanceladas = isCons ? +(nfsePRN.vCanceladas || 0) + +(nfseMed.vCanceladas || 0) : +(nfse?.vCanceladas || 0)
  const nCanceladas = isCons ? +(nfsePRN.nCanceladas || 0) + +(nfseMed.nCanceladas || 0) : +(nfse?.nCanceladas || 0)

  const fat1Loading = isCons ? (fat1PRN.loading || fat1Med.loading) : isMed ? fat1Med.loading : fat1PRN.loading
  const fat1Error   = isCons ? (fat1PRN.error   || fat1Med.error)   : isMed ? fat1Med.error   : fat1PRN.error

  // ── KPIs + dados Fonte 2 ─────────────────────────────────────────────────
  const osBrutos = useMemo(() => {
    if (isCons) return [
      ...prn.os.map((o) => ({ ...o, empresa: 'PRN'       })),
      ...med.os.map((o) => ({ ...o, empresa: 'MedImagem' })),
    ]
    return isMed ? med.os : prn.os
  }, [empresa, prn.os, med.os])

  const fat2Loading      = isCons ? (prn.loading || med.loading) : isMed ? med.loading : prn.loading
  const fat2Error        = isCons ? (prn.error   || med.error)   : isMed ? med.error   : prn.error
  const fat2RetryAfter   = isCons ? (prn.retryAfter ?? med.retryAfter) : isMed ? med.retryAfter : prn.retryAfter
  const fat2Retry        = isCons ? () => { prn.retry(); med.retry() } : isMed ? med.retry : prn.retry

  const osEmAbertoLista = useMemo(() => osBrutos.filter((o) => STATUS_ABERTO.includes(o.cStatus)), [osBrutos])
  const valorEmAberto   = useMemo(() => osEmAbertoLista.reduce((s, o) => s + o.nValorTotal, 0), [osEmAbertoLista])
  const prontasFaturar  = useMemo(() => osBrutos.filter((o) => o.cStatus === 'AOF'), [osBrutos])
  const atrasadasCount  = useMemo(() => osEmAbertoLista.filter((o) => o.atrasada).length, [osEmAbertoLista])

  const donutData = useMemo(() => {
    const counts = {}
    for (const o of osBrutos) counts[o.cStatus] = (counts[o.cStatus] ?? 0) + 1
    return Object.entries(STATUS_MAP)
      .map(([k, cfg]) => ({ label: cfg.legivel, valor: counts[k] ?? 0, cor: cfg.cor }))
      .filter((s) => s.valor > 0)
  }, [osBrutos])

  const rankingClientes = useMemo(() => {
    const map = {}
    for (const o of osEmAbertoLista) map[o.nomeCliente] = (map[o.nomeCliente] ?? 0) + o.nValorTotal
    return Object.entries(map).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor).slice(0, 5)
  }, [osEmAbertoLista])

  // ── Tabela filtrada ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = osBrutos
    if (filtroStatus === 'aberto') list = list.filter((o) => STATUS_ABERTO.includes(o.cStatus))
    else if (filtroStatus !== 'todos') list = list.filter((o) => o.cStatus === filtroStatus)
    const q = busca.toLowerCase().trim()
    if (q) list = list.filter((o) =>
      o.nomeCliente.toLowerCase().includes(q) ||
      o.cNumOS.toLowerCase().includes(q) ||
      o.cDescricao.toLowerCase().includes(q)
    )
    return sortOS(list, sortKey, sortDir)
  }, [osBrutos, filtroStatus, busca, sortKey, sortDir])

  const nColsTabela = 6 + (modo === 'avancado' ? 4 : 0) + (isCons ? 1 : 0)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 p-6 overflow-auto">

      {/* Cabeçalho */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h1>
          <p className="mt-1 text-sm text-gray-500">
            Ciclo completo: OS abertas → aprovadas → faturadas como NFS-e
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <EmpresaTabs value={empresa} onChange={(e) => { setEmpresa(e); setBusca('') }} />
          <ModoToggle valor={modo} onChange={setModo} />
        </div>
      </div>

      {/* Período */}
      <div className="mb-5">
        <SeletorPeriodo valor={periodo} onChange={setPeriodo} />
      </div>

      {/* ── KPIs Fonte 1 — carregam rápido ── */}
      {fat1Loading ? (
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0,1,2,3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-xl border border-gray-100 bg-gray-100" />)}
        </div>
      ) : fat1Error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Erro ao carregar resumo: {fat1Error}
        </div>
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="OS em Aberto"
            valor={String(nOsEmAberto)}
            sub="Total geral de OS não faturadas"
            tone="neutral"
          />
          <KpiCard
            label="NFS-e Emitidas"
            valor={fmt(vFaturadas)}
            sub={`${nFaturadas} nota${nFaturadas !== 1 ? 's' : ''} no período`}
            tone={vFaturadas > 0 ? 'green' : 'neutral'}
          />
          <KpiCard
            label="A Receber"
            valor={fmt(vPendentes)}
            sub="NFS-e aguardando pagamento"
            tone={vPendentes > 0 ? 'blue' : 'neutral'}
          />
          <KpiCard
            label="NFS-e Canceladas"
            valor={String(nCanceladas)}
            sub={nCanceladas > 0 ? fmt(vCanceladas) + ' cancelados' : 'Nenhuma cancelada'}
            tone={nCanceladas > 0 ? 'red' : 'neutral'}
          />
        </div>
      )}

      {/* ── KPIs Fonte 2 (avançado) — carregam junto com a tabela ── */}
      {modo === 'avancado' && (
        fat2Loading ? (
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[0,1,2].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-xl border border-gray-100 bg-gray-100" />)}
          </div>
        ) : !fat2Error && (
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <KpiCard
              label="Prontas p/ Faturar"
              valor={String(prontasFaturar.length)}
              sub={prontasFaturar.length > 0 ? `${fmt(prontasFaturar.reduce((s,o)=>s+o.nValorTotal,0))} disponíveis` : 'Nenhuma aprovada'}
              tone={prontasFaturar.length > 0 ? 'orange' : 'neutral'}
            />
            <KpiCard
              label="Valor em Aberto"
              valor={fmt(valorEmAberto)}
              sub="OS não faturadas no período"
              tone="neutral"
            />
            <KpiCard
              label="OS Atrasadas"
              valor={String(atrasadasCount)}
              sub={atrasadasCount > 0 ? 'Passaram da data prevista' : 'Tudo dentro do prazo'}
              tone={atrasadasCount > 0 ? 'red' : 'green'}
            />
          </div>
        )
      )}

      {/* Nota de contexto */}
      {!fat1Loading && !fat2Loading && (
        <p className="mb-5 text-xs text-gray-400">
          OS em Aberto e tabela = todas as OS no Omie (até 500 mais recentes) · NFS-e refere-se ao período selecionado
        </p>
      )}

      {/* ── Gráficos (avançado) ── */}
      {modo === 'avancado' && !fat2Loading && !fat2Error && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Distribuição por Status</h2>
            <DonutStatus data={donutData} />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Top 5 Clientes — Valor em Aberto</h2>
            <p className="mb-3 text-xs text-gray-400">Clientes com maior volume de OS não faturadas no período</p>
            <BarRankingClientes data={rankingClientes} maxVal={rankingClientes[0]?.valor ?? 0} />
          </div>
        </div>
      )}

      {/* ── Barra de filtros + tabela ── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-full max-w-xs">
            <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por cliente, nº OS ou descrição..." />
          </div>
          {modo === 'avancado' && (
            <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
              {FILTROS_STATUS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          )}
        </div>
        <p className="text-sm text-gray-500 shrink-0">
          {fat2Loading ? 'Carregando…' : `${filtered.length} OS encontrada${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {fat2Loading ? (
        <LoadingSpinner
          message={`Carregando ordens de serviço${empresa === 'consolidado' ? ' (todas as empresas)' : ` ${empresa.toUpperCase()}`}…`}
        />
      ) : fat2Error ? (
        <ErrorCard error={fat2Error} retryAfter={fat2RetryAfter} retry={fat2Retry} />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th label="Nº OS"      k="cNumOS"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <Th label="Cliente"    k="nomeCliente" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Descrição</th>
                  <Th label="Valor"      k="nValorTotal" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <Th label="Status"     k="cStatus"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Prazo</th>
                  {modo === 'avancado' && (
                    <>
                      <Th label="Criação"  k="dDataOS"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <Th label="Previsão" k="dPrevisao" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Contrato</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Responsável</th>
                    </>
                  )}
                  {isCons && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Empresa</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={nColsTabela} className="py-12 text-center text-sm text-gray-400">
                      Nenhuma ordem de serviço encontrada.
                    </td>
                  </tr>
                ) : filtered.map((o, idx) => (
                  <tr key={`${o.nCodOS}-${o.empresa ?? ''}-${idx}`}
                    className={`${o.atrasada ? 'bg-red-50/40 hover:bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-blue-700">{o.cNumOS}</td>
                    <td className="px-4 py-3 max-w-[180px] truncate font-medium text-gray-900" title={o.nomeCliente}>{o.nomeCliente}</td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-gray-600" title={o.cDescricao}>{o.cDescricao}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-700">{fmt(o.nValorTotal)}</td>
                    <td className="whitespace-nowrap px-4 py-3"><StatusBadgeOS status={o.cStatus} /></td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <AlertaAtraso atrasada={o.atrasada} dPrevisao={o.dPrevisao} />
                      {!o.atrasada && o.dPrevisao !== '—' && (
                        <span className="text-xs text-gray-400">{o.dPrevisao}</span>
                      )}
                    </td>
                    {modo === 'avancado' && (
                      <>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{o.dDataOS}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{o.dPrevisao}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">{o.cNumContrato}</td>
                        <td className="px-4 py-3 max-w-[140px] truncate text-gray-500" title={o.cResponsavel}>{o.cResponsavel}</td>
                      </>
                    )}
                    {isCons && (
                      <td className="whitespace-nowrap px-4 py-3"><EmpresaBadge empresa={o.empresa} /></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
