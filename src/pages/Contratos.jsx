import { useState, useMemo } from 'react'
import { useContratos } from '../hooks/useContratos.js'
import StatusBadge from '../components/StatusBadge.jsx'
import VencimentoBadge from '../components/VencimentoBadge.jsx'
import SearchBar from '../components/SearchBar.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import EmpresaTabs from '../components/EmpresaTabs.jsx'

const TIPO_FAT = { '01': 'Mensal', '02': 'Bimestral', '03': 'Trimestral', '04': 'Semestral', '05': 'Anual' }

function fmt(val) {
  return Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 text-gray-300">↕</span>
  return <span className="ml-1 text-blue-600">{dir === 'asc' ? '↑' : '↓'}</span>
}

function EmpresaBadge({ empresa }) {
  const isPRN = empresa === 'PRN'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
      isPRN ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
    }`}>
      {empresa}
    </span>
  )
}

const COLUMNS_BASE = [
  { key: 'cNumCtr',       label: 'Nº Contrato'  },
  { key: 'nomeCliente',   label: 'Cliente'       },
  { key: 'nValTotMes',    label: 'Valor Mensal'  },
  { key: 'dVigInicial',   label: 'Início'        },
  { key: 'dVigFinal',     label: 'Fim'           },
  { key: 'cCodSit',       label: 'Status'        },
  { key: 'diasRestantes', label: 'Vencimento'    },
  { key: 'cTipoFat',      label: 'Tipo Fat.'     },
]
const COLUMN_EMPRESA = { key: 'empresa', label: 'Empresa' }

function ErrorCard({ error, retryAfter, retry }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <p className="text-sm font-semibold text-red-700">Erro ao carregar contratos</p>
      <p className="mt-2 text-xs text-red-500 max-w-md mx-auto">{error}</p>
      <div className="mt-4 flex items-center justify-center gap-3">
        {retryAfter !== null ? (
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-700 ring-1 ring-orange-200">
            <span className="animate-pulse">⏱</span>
            Tentando novamente em <span className="tabular-nums font-bold">{retryAfter}s</span>
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

export default function Contratos() {
  const [empresa, setEmpresa] = useState('prn')
  const [busca, setBusca]     = useState('')
  const [sortKey, setSortKey] = useState('diasRestantes')
  const [sortDir, setSortDir] = useState('asc')

  // Ambos os hooks rodam sempre; MedImagem espera PRN terminar (serialização anti-425)
  const prn = useContratos('prn')
  const med = useContratos('medimagem', { enabled: !prn.loading })

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  // Decide qual lista usar conforme aba selecionada
  const contratosBrutos = useMemo(() => {
    if (empresa === 'consolidado') {
      return [
        ...prn.contratos.map((c) => ({ ...c, empresa: 'PRN' })),
        ...med.contratos.map((c) => ({ ...c, empresa: 'MedImagem' })),
      ]
    }
    return empresa === 'prn' ? prn.contratos : med.contratos
  }, [empresa, prn.contratos, med.contratos])

  const activeHook = empresa === 'medimagem' ? med : prn
  const isLoading  = empresa === 'consolidado' ? (prn.loading || med.loading) : activeHook.loading
  const activeError = empresa === 'consolidado' ? (prn.error || med.error) : activeHook.error
  const activeRetryAfter = empresa === 'consolidado' ? (prn.retryAfter ?? med.retryAfter) : activeHook.retryAfter
  const activeRetry = empresa === 'consolidado'
    ? () => { prn.retry(); med.retry() }
    : activeHook.retry

  const COLUMNS = empresa === 'consolidado'
    ? [...COLUMNS_BASE, COLUMN_EMPRESA]
    : COLUMNS_BASE

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim()
    const list = q
      ? contratosBrutos.filter(
          (c) => c.nomeCliente.toLowerCase().includes(q) || c.cNumCtr.toLowerCase().includes(q)
        )
      : contratosBrutos

    return [...list].sort((a, b) => {
      let va = a[sortKey] ?? '', vb = b[sortKey] ?? ''
      if (sortKey === 'diasRestantes') {
        if (va === null && vb === null) return 0
        if (va === null) return 1
        if (vb === null) return -1
        return sortDir === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va)
      }
      if (sortKey === 'nValTotMes') {
        va = Number(va); vb = Number(vb)
        return sortDir === 'asc' ? va - vb : vb - va
      }
      if (sortKey === 'dVigInicial' || sortKey === 'dVigFinal') {
        const toNum = (d) => { const [dd, mm, yyyy] = String(d).split('/'); return Number(`${yyyy}${mm}${dd}`) || 0 }
        return sortDir === 'asc' ? toNum(va) - toNum(vb) : toNum(vb) - toNum(va)
      }
      const cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [contratosBrutos, busca, sortKey, sortDir])

  const ativos      = contratosBrutos.filter((c) => c.cCodSit === '10')
  const totalMensal = ativos.reduce((s, c) => s + Number(c.nValTotMes), 0)
  const vencendo30  = ativos.filter((c) => c.diasRestantes !== null && c.diasRestantes <= 30).length
  const vencendo90  = ativos.filter((c) => c.diasRestantes !== null && c.diasRestantes > 30 && c.diasRestantes <= 90).length

  return (
    <div className="flex-1 p-6 overflow-auto">

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos de Serviço</h1>
          <p className="mt-1 text-sm text-gray-500">Serviços e NFS-e — Contratos cadastrados no Omie</p>
        </div>
        <EmpresaTabs value={empresa} onChange={(e) => { setEmpresa(e); setBusca('') }} />
      </div>

      {/* KPI Cards — skeleton enquanto carrega (evita números parciais no Consolidado) */}
      {isLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-xl border border-gray-100 bg-gray-100" />
          ))}
        </div>
      ) : (
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total de Contratos</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{contratosBrutos.length}</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-green-50 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-green-700">Ativos</p>
          <p className="mt-1 text-3xl font-bold text-green-800">{ativos.length}</p>
          <p className="mt-0.5 text-sm text-green-600">{fmt(totalMensal)}/mês</p>
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${vencendo30 > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${vencendo30 > 0 ? 'text-red-600' : 'text-gray-500'}`}>
            Vencem em até 30d
          </p>
          <p className={`mt-1 text-3xl font-bold ${vencendo30 > 0 ? 'text-red-700' : 'text-gray-400'}`}>{vencendo30}</p>
          {vencendo30 > 0 && <p className="mt-0.5 text-xs text-red-500">⚠ Atenção urgente</p>}
        </div>
        <div className={`rounded-xl border p-4 shadow-sm ${vencendo90 > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-white'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${vencendo90 > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
            Vencem em 31–90d
          </p>
          <p className={`mt-1 text-3xl font-bold ${vencendo90 > 0 ? 'text-orange-700' : 'text-gray-400'}`}>{vencendo90}</p>
          {vencendo90 > 0 && <p className="mt-0.5 text-xs text-orange-500">Renovar em breve</p>}
        </div>
      </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-sm">
          <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por cliente ou nº contrato..." />
        </div>
        <p className="text-sm text-gray-500 shrink-0">
          {isLoading ? '—' : `${filtered.length} contrato${filtered.length !== 1 ? 's' : ''} encontrado${filtered.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Table / States */}
      {isLoading ? (
        <LoadingSpinner message={`Carregando contratos ${empresa === 'consolidado' ? 'de todas as empresas' : empresa.toUpperCase()}...`} />
      ) : activeError ? (
        <ErrorCard error={activeError} retryAfter={activeRetryAfter} retry={activeRetry} />
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-100"
                    >
                      {col.label}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="py-12 text-center text-sm text-gray-400">
                      Nenhum contrato encontrado.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c, idx) => {
                    const urgente = c.diasRestantes !== null && c.diasRestantes <= 30
                    const atencao = c.diasRestantes !== null && c.diasRestantes > 30 && c.diasRestantes <= 90
                    const rowCls  = urgente
                      ? 'bg-red-50/40 hover:bg-red-50 transition-colors'
                      : atencao
                      ? 'bg-orange-50/30 hover:bg-orange-50 transition-colors'
                      : 'hover:bg-gray-50 transition-colors'
                    return (
                      <tr key={`${c.nCodCtr}-${c.empresa ?? ''}-${idx}`} className={rowCls}>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-medium text-blue-700">{c.cNumCtr}</td>
                        <td className="px-4 py-3 max-w-xs truncate font-medium text-gray-900" title={c.nomeCliente}>{c.nomeCliente}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-700">{fmt(c.nValTotMes)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{c.dVigInicial}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{c.dVigFinal}</td>
                        <td className="whitespace-nowrap px-4 py-3"><StatusBadge cod={c.cCodSit} /></td>
                        <td className="whitespace-nowrap px-4 py-3"><VencimentoBadge dias={c.diasRestantes} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{TIPO_FAT[c.cTipoFat] ?? c.cTipoFat}</td>
                        {empresa === 'consolidado' && (
                          <td className="whitespace-nowrap px-4 py-3"><EmpresaBadge empresa={c.empresa} /></td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
