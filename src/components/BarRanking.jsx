import { fmtBig, fmtPct } from '../utils/format.js'

// Barras horizontais ordenadas. items: [{ nome, valor, qtd? }]
// colorFn(item, idx) opcional para colorir por faixa (ex.: aging).
// mostrarPct: exibe a fatia (% do total) ao lado do valor.
export default function BarRanking({ items, color = '#0D2B55', colorFn, mostrarQtd = false, mostrarPct = false }) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-gray-400">Sem dados.</p>
  }
  const max = Math.max(...items.map((i) => i.valor), 1)
  const total = mostrarPct ? items.reduce((s, i) => s + (Number(i.valor) || 0), 0) : 0
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((it, idx) => {
        const pct = Math.max((it.valor / max) * 100, 1.5)
        const c = colorFn ? colorFn(it, idx) : color
        return (
          <div key={it.nome}>
            <div className="mb-1 flex justify-between gap-2 text-xs text-gray-600">
              <span className="truncate" title={it.nome}>
                {it.nome}
                {mostrarQtd && it.qtd != null && <span className="text-gray-400"> ({it.qtd})</span>}
              </span>
              <span className="shrink-0 font-medium text-gray-700">
                {fmtBig(it.valor)}
                {mostrarPct && total > 0 && <span className="ml-1 font-normal text-gray-400">({fmtPct((it.valor / total) * 100)})</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
