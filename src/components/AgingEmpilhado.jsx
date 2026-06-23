import { fmtBig, fmtPct } from '../utils/format.js'

const CORES = ['#16a34a', '#EF9F27', '#D85A30', '#b45309', '#A32D2D']

// Barra 100% empilhada do aging (proporção entre faixas de atraso). buckets = bucketsAging(recAb).
export default function AgingEmpilhado({ buckets, cores = CORES }) {
  const total = (buckets || []).reduce((s, b) => s + (Number(b.valor) || 0), 0)
  if (!buckets || total <= 0) {
    return <p className="text-sm text-gray-400">Nenhum título a receber em aberto.</p>
  }

  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-gray-100">
        {buckets.map((b, i) => (b.valor > 0 ? (
          <div key={b.nome} title={`${b.nome}: ${fmtBig(b.valor)}`} style={{ width: `${(b.valor / total) * 100}%`, backgroundColor: cores[i] ?? '#A32D2D' }} />
        ) : null))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {buckets.map((b, i) => (
          <div key={b.nome} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cores[i] ?? '#A32D2D' }} />
            <span className="flex-1 truncate text-gray-600">{b.nome}{b.qtd != null && <span className="text-gray-400"> ({b.qtd})</span>}</span>
            <span className="shrink-0 font-medium tabular-nums text-gray-700">{fmtBig(b.valor)}</span>
            <span className="w-12 shrink-0 text-right tabular-nums text-gray-400">{fmtPct((b.valor / total) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
