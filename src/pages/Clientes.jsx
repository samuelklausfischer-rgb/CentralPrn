import { useState, useMemo } from 'react'
import { useClientes } from '../hooks/useClientes.js'
import { useFornecedores } from '../hooks/useFornecedores.js'
import SearchBar from '../components/SearchBar.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import EmpresaTabs from '../components/EmpresaTabs.jsx'
import BarRanking from '../components/BarRanking.jsx'
import { fmt, fmtBig, fmtPct } from '../utils/format.js'

// ─── helpers visuais ─────────────────────────────────────────────────────────

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1 text-blue-600">{dir === 'asc' ? '↑' : '↓'}</span>
}

function SectionHeader({ titulo, sub }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 h-5 w-[3px] shrink-0 rounded-full bg-[#F26522]" />
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-[#0D2B55]">{titulo}</h2>
        {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

function Bloco({ titulo, sub, children }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader titulo={titulo} sub={sub} />
      {children}
    </div>
  )
}

function ErrorCard({ error, retryAfter, retry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <p className="text-sm font-semibold text-red-700">Erro ao carregar dados</p>
      <p className="mt-2 text-xs text-red-500 max-w-md mx-auto">{error}</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        {retryAfter !== null ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 ring-1 ring-orange-200">
            <span className="animate-pulse">⏱</span>
            Tentando em <span className="tabular-nums font-bold">{retryAfter}s</span>
          </div>
        ) : (
          <button
            onClick={retry}
            className="inline-flex items-center gap-2 rounded-md bg-[#0D2B55] px-4 py-2 text-xs font-medium text-white hover:bg-blue-900 transition-colors"
          >
            ↺ Tentar novamente
          </button>
        )}
      </div>
    </div>
  )
}

function StatusClienteBadge({ temContrato, temAtraso }) {
  if (!temContrato) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
        Sem contrato
      </span>
    )
  }
  if (temAtraso) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
        Em atraso
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
      Adimplente
    </span>
  )
}

function StatusFornecedorBadge({ temAtraso }) {
  if (temAtraso) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-200">
        Em atraso
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-200">
      Em dia
    </span>
  )
}

// ─── merge de listas ─────────────────────────────────────────────────────────

function mergeClientesConsolidado(prnList, medList) {
  const map = new Map()
  for (const c of [...prnList, ...medList]) {
    if (map.has(c.id)) {
      const ex = map.get(c.id)
      const novoAtraso = ex.valorEmAtraso + c.valorEmAtraso
      map.set(c.id, {
        ...ex,
        qtdContratos:   ex.qtdContratos + c.qtdContratos,
        mrr:            ex.mrr + c.mrr,
        temContrato:    ex.temContrato || c.temContrato,
        totalAReceber:  ex.totalAReceber + c.totalAReceber,
        valorEmAtraso:  novoAtraso,
        maxDiasAtraso:  Math.max(ex.maxDiasAtraso, c.maxDiasAtraso),
        temAtraso:      novoAtraso > 0,
      })
    } else {
      map.set(c.id, { ...c })
    }
  }
  return [...map.values()]
}

function mergeFornecedoresConsolidado(prnList, medList) {
  const map = new Map()
  for (const f of [...prnList, ...medList]) {
    if (map.has(f.nome)) {
      const ex = map.get(f.nome)
      const novoAtraso = ex.emAtraso + f.emAtraso
      map.set(f.nome, {
        ...ex,
        totalAPagar:   ex.totalAPagar + f.totalAPagar,
        emAtraso:      novoAtraso,
        maxDiasAtraso: Math.max(ex.maxDiasAtraso, f.maxDiasAtraso),
        temAtraso:     novoAtraso > 0,
      })
    } else {
      map.set(f.nome, { ...f })
    }
  }
  return [...map.values()]
}

// ─── constantes ──────────────────────────────────────────────────────────────

const FILTROS_CLI = [
  { key: 'com_contrato',  label: 'Com Contrato' },
  { key: 'todos',         label: 'Todos'         },
  { key: 'em_atraso',    label: 'Em Atraso'     },
  { key: 'sem_contrato',  label: 'Sem Contrato' },
]

const FILTROS_FORN = [
  { key: 'todos',    label: 'Todos'    },
  { key: 'em_atraso', label: 'Em Atraso' },
  { key: 'em_dia',   label: 'Em Dia'   },
]

const COLS_CLI = [
  { key: 'nome',          label: 'Cliente'    },
  { key: 'cidade',        label: 'Localidade' },
  { key: 'qtdContratos',  label: 'Contratos'  },
  { key: 'mrr',           label: 'MRR'        },
  { key: 'totalAReceber', label: 'A Receber'  },
  { key: 'valorEmAtraso', label: 'Em Atraso'  },
]

const COLS_FORN = [
  { key: 'nome',          label: 'Fornecedor'  },
  { key: 'categoria',     label: 'Categoria'   },
  { key: 'totalAPagar',   label: 'A Pagar'     },
  { key: 'emAtraso',      label: 'Em Atraso'   },
  { key: 'maxDiasAtraso', label: 'Dias Atraso' },
]

// ─── página ──────────────────────────────────────────────────────────────────

export default function Clientes() {
  const [empresa, setEmpresa] = useState('prn')
  const [tab, setTab]         = useState('clientes')

  // Estado da aba Clientes
  const [buscaCli, setBuscaCli]     = useState('')
  const [filtroCli, setFiltroCli]   = useState('com_contrato')
  const [sortCli, setSortCli]       = useState('mrr')
  const [sortDirCli, setSortDirCli] = useState('desc')

  // Estado da aba Fornecedores
  const [buscaForn, setBuscaForn]     = useState('')
  const [filtroForn, setFiltroForn]   = useState('todos')
  const [sortForn, setSortForn]       = useState('totalAPagar')
  const [sortDirForn, setSortDirForn] = useState('desc')

  // Hooks — Clientes (carregam imediatamente, aba padrão)
  const prn = useClientes('prn')
  const med = useClientes('medimagem', { enabled: !prn.loading })

  // Hooks — Fornecedores (lazy: só carrega quando aba é clicada)
  const fornPrn = useFornecedores('prn', { enabled: tab === 'fornecedores' })
  const fornMed = useFornecedores('medimagem', {
    enabled: tab === 'fornecedores' && !fornPrn.loading,
  })

  function handleEmpresa(e) {
    setEmpresa(e)
    setBuscaCli(''); setFiltroCli('com_contrato')
    setBuscaForn(''); setFiltroForn('todos')
  }

  function handleTab(t) {
    setTab(t)
    setBuscaCli(''); setBuscaForn('')
  }

  function handleSortCli(key) {
    if (sortCli === key) setSortDirCli((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCli(key); setSortDirCli(key === 'nome' ? 'asc' : 'desc') }
  }

  function handleSortForn(key) {
    if (sortForn === key) setSortDirForn((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortForn(key); setSortDirForn(key === 'nome' || key === 'categoria' ? 'asc' : 'desc') }
  }

  // ── Lista base de clientes ────────────────────────────────────────────────
  const clientesBrutos = useMemo(() => {
    if (empresa === 'consolidado') return mergeClientesConsolidado(prn.clientes, med.clientes)
    return empresa === 'prn' ? prn.clientes : med.clientes
  }, [empresa, prn.clientes, med.clientes])

  const activeCliHook    = empresa === 'medimagem' ? med : prn
  const isLoadingCli     = empresa === 'consolidado' ? (prn.loading || med.loading) : activeCliHook.loading
  const errorCli         = empresa === 'consolidado' ? (prn.error || med.error) : activeCliHook.error
  const retryAfterCli    = empresa === 'consolidado' ? (prn.retryAfter ?? med.retryAfter) : activeCliHook.retryAfter
  const retryCli         = empresa === 'consolidado'
    ? () => { prn.retry(); med.retry() }
    : activeCliHook.retry

  // ── Lista base de fornecedores ────────────────────────────────────────────
  const fornBrutos = useMemo(() => {
    if (empresa === 'consolidado') return mergeFornecedoresConsolidado(fornPrn.fornecedores, fornMed.fornecedores)
    return empresa === 'prn' ? fornPrn.fornecedores : fornMed.fornecedores
  }, [empresa, fornPrn.fornecedores, fornMed.fornecedores])

  const activeFornHook  = empresa === 'medimagem' ? fornMed : fornPrn
  const isLoadingForn   = empresa === 'consolidado' ? (fornPrn.loading || fornMed.loading) : activeFornHook.loading
  const errorForn       = empresa === 'consolidado' ? (fornPrn.error || fornMed.error) : activeFornHook.error
  const retryAfterForn  = empresa === 'consolidado' ? (fornPrn.retryAfter ?? fornMed.retryAfter) : activeFornHook.retryAfter
  const retryForn       = empresa === 'consolidado'
    ? () => { fornPrn.retry(); fornMed.retry() }
    : activeFornHook.retry

  // ── KPIs clientes ────────────────────────────────────────────────────────
  const comContratoList  = useMemo(() => clientesBrutos.filter((c) => c.temContrato), [clientesBrutos])
  const emAtrasoCliList  = useMemo(() => clientesBrutos.filter((c) => c.temAtraso),   [clientesBrutos])
  const mrrTotal         = useMemo(() => comContratoList.reduce((s, c) => s + c.mrr, 0),           [comContratoList])
  const valorAtrasoCli   = useMemo(() => emAtrasoCliList.reduce((s, c) => s + c.valorEmAtraso, 0), [emAtrasoCliList])
  const adimplencia      = comContratoList.length > 0
    ? (comContratoList.filter((c) => !c.temAtraso).length / comContratoList.length * 100)
    : 0

  // ── Rankings clientes ─────────────────────────────────────────────────────
  const topMRR = useMemo(() =>
    [...comContratoList].sort((a, b) => b.mrr - a.mrr).slice(0, 8).map((c) => ({ nome: c.nome, valor: c.mrr })),
    [comContratoList]
  )
  const topDevedores = useMemo(() =>
    [...emAtrasoCliList].sort((a, b) => b.valorEmAtraso - a.valorEmAtraso).slice(0, 5)
      .map((c) => ({ nome: c.nome, valor: c.valorEmAtraso })),
    [emAtrasoCliList]
  )

  // ── Tabela clientes filtrada ──────────────────────────────────────────────
  const filteredCli = useMemo(() => {
    let list = clientesBrutos
    if (filtroCli === 'com_contrato')  list = list.filter((c) => c.temContrato)
    else if (filtroCli === 'em_atraso')  list = list.filter((c) => c.temAtraso)
    else if (filtroCli === 'sem_contrato') list = list.filter((c) => !c.temContrato)
    const q = buscaCli.toLowerCase().trim()
    if (q) list = list.filter((c) => c.nome.toLowerCase().includes(q) || c.cidade.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      const va = a[sortCli] ?? 0, vb = b[sortCli] ?? 0
      if (sortCli === 'nome' || sortCli === 'cidade') {
        const cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
        return sortDirCli === 'asc' ? cmp : -cmp
      }
      return sortDirCli === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va)
    })
  }, [clientesBrutos, filtroCli, buscaCli, sortCli, sortDirCli])

  // ── KPIs fornecedores ─────────────────────────────────────────────────────
  const totalAPagar    = useMemo(() => fornBrutos.reduce((s, f) => s + f.totalAPagar, 0), [fornBrutos])
  const totalAtrasoPag = useMemo(() => fornBrutos.reduce((s, f) => s + f.emAtraso, 0),    [fornBrutos])
  const emAtrasoPagList = useMemo(() => fornBrutos.filter((f) => f.temAtraso),              [fornBrutos])
  const topFornecedor  = useMemo(() =>
    [...fornBrutos].sort((a, b) => b.totalAPagar - a.totalAPagar)[0] ?? null,
    [fornBrutos]
  )
  const pctConcentracao = topFornecedor && totalAPagar > 0
    ? (topFornecedor.totalAPagar / totalAPagar * 100) : 0

  // ── Rankings fornecedores ─────────────────────────────────────────────────
  const topAPagar = useMemo(() =>
    [...fornBrutos].sort((a, b) => b.totalAPagar - a.totalAPagar).slice(0, 8)
      .map((f) => ({ nome: f.nome, valor: f.totalAPagar })),
    [fornBrutos]
  )
  const topAtrasados = useMemo(() =>
    [...emAtrasoPagList].sort((a, b) => b.emAtraso - a.emAtraso).slice(0, 5)
      .map((f) => ({ nome: f.nome, valor: f.emAtraso })),
    [emAtrasoPagList]
  )

  // ── Tabela fornecedores filtrada ──────────────────────────────────────────
  const filteredForn = useMemo(() => {
    let list = fornBrutos
    if (filtroForn === 'em_atraso') list = list.filter((f) => f.temAtraso)
    else if (filtroForn === 'em_dia')  list = list.filter((f) => !f.temAtraso)
    const q = buscaForn.toLowerCase().trim()
    if (q) list = list.filter((f) => f.nome.toLowerCase().includes(q) || f.categoria.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      const va = a[sortForn] ?? 0, vb = b[sortForn] ?? 0
      if (sortForn === 'nome' || sortForn === 'categoria') {
        const cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
        return sortDirForn === 'asc' ? cmp : -cmp
      }
      return sortDirForn === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va)
    })
  }, [fornBrutos, filtroForn, buscaForn, sortForn, sortDirForn])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 p-6 overflow-auto">

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie sua carteira de clientes e fornecedores</p>
        </div>
        <EmpresaTabs value={empresa} onChange={handleEmpresa} />
      </div>

      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1 w-fit">
        {[
          { key: 'clientes',     label: '🏥 Nossos Clientes',     sub: 'quem nos paga'    },
          { key: 'fornecedores', label: '🏢 Nossos Fornecedores', sub: 'quem pagamos' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => handleTab(t.key)}
            className={`flex flex-col items-start rounded-lg px-4 py-2.5 text-sm transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 font-semibold shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.label}</span>
            <span className="text-[11px] font-normal text-gray-400">{t.sub}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════ ABA: NOSSOS CLIENTES ══════════════════════ */}
      {tab === 'clientes' && (
        <>
          {/* KPIs clientes */}
          {isLoadingCli ? (
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0,1,2,3].map((i) => (
                <div key={i} className="h-[92px] animate-pulse rounded-xl border border-gray-100 bg-gray-100" />
              ))}
            </div>
          ) : (
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total de Clientes</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{clientesBrutos.length}</p>
                <p className="mt-0.5 text-xs text-gray-400">cadastros no Omie</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-green-700">Com Contrato Ativo</p>
                <p className="mt-1 text-3xl font-bold text-green-800">{comContratoList.length}</p>
                <p className="mt-0.5 text-xs text-green-600">{fmtBig(mrrTotal)}/mês</p>
              </div>
              <div className={`rounded-xl border p-4 shadow-sm ${
                emAtrasoCliList.length > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'
              }`}>
                <p className={`text-xs font-medium uppercase tracking-wide ${
                  emAtrasoCliList.length > 0 ? 'text-red-600' : 'text-gray-500'
                }`}>Inadimplentes</p>
                <p className={`mt-1 text-3xl font-bold ${
                  emAtrasoCliList.length > 0 ? 'text-red-700' : 'text-gray-400'
                }`}>{emAtrasoCliList.length}</p>
                {emAtrasoCliList.length > 0
                  ? <p className="mt-0.5 text-xs text-red-500">{fmt(valorAtrasoCli)} em aberto</p>
                  : <p className="mt-0.5 text-xs text-gray-400">Nenhum em atraso</p>
                }
              </div>
              {(() => {
                const cls = adimplencia >= 90
                  ? { b: 'border-green-100', bg: 'bg-green-50', l: 'text-green-700', v: 'text-green-800', s: 'text-green-600' }
                  : adimplencia >= 70
                  ? { b: 'border-orange-200', bg: 'bg-orange-50', l: 'text-orange-600', v: 'text-orange-700', s: 'text-orange-500' }
                  : { b: 'border-red-200', bg: 'bg-red-50', l: 'text-red-600', v: 'text-red-700', s: 'text-red-500' }
                return (
                  <div className={`rounded-xl border p-4 shadow-sm ${cls.b} ${cls.bg}`}>
                    <p className={`text-xs font-medium uppercase tracking-wide ${cls.l}`}>Adimplência</p>
                    <p className={`mt-1 text-3xl font-bold ${cls.v}`}>{fmtPct(adimplencia, 1)}</p>
                    <p className={`mt-0.5 text-xs ${cls.s}`}>dos clientes com contrato</p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Conteúdo clientes */}
          {isLoadingCli ? (
            <LoadingSpinner
              message={`Carregando clientes ${empresa === 'consolidado' ? 'de todas as empresas' : empresa.toUpperCase()}...`}
            />
          ) : errorCli ? (
            <ErrorCard error={errorCli} retryAfter={retryAfterCli} retry={retryCli} />
          ) : (
            <>
              {/* Rankings */}
              <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Bloco titulo="Maiores Clientes por MRR" sub="Top 8 por receita mensal de contratos ativos">
                  {topMRR.length > 0
                    ? <BarRanking items={topMRR} color="#0D2B55" />
                    : <p className="py-4 text-center text-sm text-gray-400">Nenhum cliente com contrato ativo.</p>
                  }
                </Bloco>
                <Bloco titulo="Maiores Inadimplentes" sub="Top 5 por valor de recebíveis em atraso">
                  {topDevedores.length > 0
                    ? <BarRanking items={topDevedores} color="#A32D2D" />
                    : (
                      <div className="flex flex-col items-center justify-center gap-1 py-6">
                        <span className="text-2xl">✓</span>
                        <p className="text-sm font-medium text-gray-600">Nenhum cliente inadimplente</p>
                        <p className="text-xs text-gray-400">Carteira 100% adimplente</p>
                      </div>
                    )
                  }
                </Bloco>
              </div>

              {/* Tabela clientes */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="w-full max-w-xs">
                    <SearchBar value={buscaCli} onChange={setBuscaCli} placeholder="Buscar por nome ou cidade..." />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FILTROS_CLI.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFiltroCli(f.key)}
                        className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          filtroCli === f.key
                            ? 'bg-[#0D2B55] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {f.label}
                        {f.key === 'em_atraso' && emAtrasoCliList.length > 0 && (
                          <span className={`ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                            filtroCli === f.key ? 'bg-red-400 text-white' : 'bg-red-100 text-red-600'
                          }`}>
                            {emAtrasoCliList.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-b border-gray-50 px-4 py-2 text-xs text-gray-400">
                  {filteredCli.length} cliente{filteredCli.length !== 1 ? 's' : ''} encontrado{filteredCli.length !== 1 ? 's' : ''}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {COLS_CLI.map((col) => (
                          <th
                            key={col.key}
                            onClick={() => handleSortCli(col.key)}
                            className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-100"
                          >
                            {col.label}<SortIcon active={sortCli === col.key} dir={sortDirCli} />
                          </th>
                        ))}
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCli.length === 0 ? (
                        <tr>
                          <td colSpan={COLS_CLI.length + 1} className="py-12 text-center text-sm text-gray-400">
                            Nenhum cliente encontrado.
                          </td>
                        </tr>
                      ) : filteredCli.map((c) => {
                        const grave = c.temAtraso && c.maxDiasAtraso > 30
                        const leve  = c.temAtraso && c.maxDiasAtraso <= 30
                        const rowCls = grave ? 'bg-red-50/40 hover:bg-red-50 transition-colors'
                          : leve ? 'bg-orange-50/30 hover:bg-orange-50 transition-colors'
                          : 'hover:bg-gray-50 transition-colors'
                        return (
                          <tr key={c.id} className={rowCls}>
                            <td className="px-4 py-3 max-w-[220px]">
                              <p className="font-medium text-gray-900 truncate" title={c.nome}>{c.nome}</p>
                              {c.cnpj && <p className="text-[11px] text-gray-400 font-mono">{c.cnpj}</p>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                              {c.cidade !== '—' || c.estado !== '—' ? `${c.cidade} · ${c.estado}` : '—'}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                              {c.qtdContratos > 0
                                ? <span className="font-medium">{c.qtdContratos} ativo{c.qtdContratos !== 1 ? 's' : ''}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-700">
                              {c.mrr > 0 ? fmtBig(c.mrr) : <span className="text-gray-300 font-normal">—</span>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right text-gray-600">
                              {c.totalAReceber > 0 ? fmt(c.totalAReceber) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              {c.valorEmAtraso > 0
                                ? <span className="text-red-600 font-medium">{fmt(c.valorEmAtraso)}<span className="ml-1 text-xs text-red-400">· {c.maxDiasAtraso}d</span></span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <StatusClienteBadge temContrato={c.temContrato} temAtraso={c.temAtraso} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ══════════════════ ABA: NOSSOS FORNECEDORES ══════════════════════ */}
      {tab === 'fornecedores' && (
        <>
          {/* KPIs fornecedores */}
          {isLoadingForn ? (
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[0,1,2,3].map((i) => (
                <div key={i} className="h-[92px] animate-pulse rounded-xl border border-gray-100 bg-gray-100" />
              ))}
            </div>
          ) : (
            <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total de Fornecedores</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{fornBrutos.length}</p>
                <p className="mt-0.5 text-xs text-gray-400">com títulos em aberto</p>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Total a Pagar</p>
                <p className="mt-1 text-3xl font-bold text-[#0D2B55]">{fmtBig(totalAPagar)}</p>
                <p className="mt-0.5 text-xs text-blue-600">comprometido</p>
              </div>
              <div className={`rounded-xl border p-4 shadow-sm ${
                emAtrasoPagList.length > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'
              }`}>
                <p className={`text-xs font-medium uppercase tracking-wide ${
                  emAtrasoPagList.length > 0 ? 'text-red-600' : 'text-gray-500'
                }`}>Vencido</p>
                <p className={`mt-1 text-3xl font-bold ${
                  emAtrasoPagList.length > 0 ? 'text-red-700' : 'text-gray-400'
                }`}>{fmtBig(totalAtrasoPag)}</p>
                {emAtrasoPagList.length > 0
                  ? <p className="mt-0.5 text-xs text-red-500">{emAtrasoPagList.length} fornecedor{emAtrasoPagList.length !== 1 ? 'es' : ''} em atraso</p>
                  : <p className="mt-0.5 text-xs text-gray-400">Todos os pagamentos em dia</p>
                }
              </div>
              <div className={`rounded-xl border p-4 shadow-sm ${
                pctConcentracao >= 50 ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'
              }`}>
                <p className={`text-xs font-medium uppercase tracking-wide ${
                  pctConcentracao >= 50 ? 'text-orange-600' : 'text-gray-500'
                }`}>Maior Concentração</p>
                {topFornecedor ? (
                  <>
                    <p className={`mt-1 text-3xl font-bold ${
                      pctConcentracao >= 50 ? 'text-orange-700' : 'text-gray-700'
                    }`}>{fmtPct(pctConcentracao, 0)}</p>
                    <p className={`mt-0.5 text-xs truncate ${
                      pctConcentracao >= 50 ? 'text-orange-500' : 'text-gray-400'
                    }`} title={topFornecedor.nome}>{topFornecedor.nome}</p>
                  </>
                ) : (
                  <p className="mt-1 text-3xl font-bold text-gray-400">—</p>
                )}
              </div>
            </div>
          )}

          {/* Conteúdo fornecedores */}
          {isLoadingForn ? (
            <LoadingSpinner
              message={`Carregando fornecedores ${empresa === 'consolidado' ? 'de todas as empresas' : empresa.toUpperCase()}...`}
            />
          ) : errorForn ? (
            <ErrorCard error={errorForn} retryAfter={retryAfterForn} retry={retryForn} />
          ) : (
            <>
              {/* Rankings */}
              <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Bloco titulo="Maiores por A Pagar" sub="Top 8 fornecedores por valor total em aberto">
                  {topAPagar.length > 0
                    ? <BarRanking items={topAPagar} color="#0D2B55" />
                    : <p className="py-4 text-center text-sm text-gray-400">Sem títulos a pagar no momento.</p>
                  }
                </Bloco>
                <Bloco titulo="Pagamentos em Atraso" sub="Top 5 fornecedores com pagamentos vencidos">
                  {topAtrasados.length > 0
                    ? <BarRanking items={topAtrasados} color="#A32D2D" />
                    : (
                      <div className="flex flex-col items-center justify-center gap-1 py-6">
                        <span className="text-2xl">✓</span>
                        <p className="text-sm font-medium text-gray-600">Todos os pagamentos em dia</p>
                        <p className="text-xs text-gray-400">Nenhum fornecedor em atraso</p>
                      </div>
                    )
                  }
                </Bloco>
              </div>

              {/* Tabela fornecedores */}
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="w-full max-w-xs">
                    <SearchBar value={buscaForn} onChange={setBuscaForn} placeholder="Buscar por fornecedor ou categoria..." />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FILTROS_FORN.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFiltroForn(f.key)}
                        className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                          filtroForn === f.key
                            ? 'bg-[#0D2B55] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {f.label}
                        {f.key === 'em_atraso' && emAtrasoPagList.length > 0 && (
                          <span className={`ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                            filtroForn === f.key ? 'bg-red-400 text-white' : 'bg-red-100 text-red-600'
                          }`}>
                            {emAtrasoPagList.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-b border-gray-50 px-4 py-2 text-xs text-gray-400">
                  {filteredForn.length} fornecedor{filteredForn.length !== 1 ? 'es' : ''} encontrado{filteredForn.length !== 1 ? 's' : ''}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {COLS_FORN.map((col) => (
                          <th
                            key={col.key}
                            onClick={() => handleSortForn(col.key)}
                            className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-100"
                          >
                            {col.label}<SortIcon active={sortForn === col.key} dir={sortDirForn} />
                          </th>
                        ))}
                        <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredForn.length === 0 ? (
                        <tr>
                          <td colSpan={COLS_FORN.length + 1} className="py-12 text-center text-sm text-gray-400">
                            Nenhum fornecedor encontrado.
                          </td>
                        </tr>
                      ) : filteredForn.map((f) => {
                        const grave = f.temAtraso && f.maxDiasAtraso > 30
                        const leve  = f.temAtraso && f.maxDiasAtraso <= 30
                        const rowCls = grave ? 'bg-red-50/40 hover:bg-red-50 transition-colors'
                          : leve ? 'bg-orange-50/30 hover:bg-orange-50 transition-colors'
                          : 'hover:bg-gray-50 transition-colors'
                        return (
                          <tr key={f.nome} className={rowCls}>
                            <td className="px-4 py-3 max-w-[220px]">
                              <p className="font-medium text-gray-900 truncate" title={f.nome}>{f.nome}</p>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{f.categoria}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-700">
                              {fmt(f.totalAPagar)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              {f.emAtraso > 0
                                ? <span className="text-red-600 font-medium">{fmt(f.emAtraso)}</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              {f.maxDiasAtraso > 0
                                ? <span className={`font-medium ${f.maxDiasAtraso > 30 ? 'text-red-600' : 'text-orange-600'}`}>{f.maxDiasAtraso}d</span>
                                : <span className="text-gray-300">—</span>
                              }
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              <StatusFornecedorBadge temAtraso={f.temAtraso} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
