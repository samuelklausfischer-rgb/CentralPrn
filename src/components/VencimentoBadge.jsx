export default function VencimentoBadge({ dias }) {
  if (dias === null || dias === undefined) return <span className="text-gray-300">—</span>

  if (dias < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
        ⚠ Vencido há {Math.abs(dias)}d
      </span>
    )
  }
  if (dias === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 animate-pulse">
        ⚠ Vence hoje
      </span>
    )
  }
  if (dias <= 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 ring-1 ring-inset ring-red-200">
        🔴 {dias}d restantes
      </span>
    )
  }
  if (dias <= 90) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
        🟡 {dias}d restantes
      </span>
    )
  }
  if (dias <= 180) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-semibold text-yellow-700 ring-1 ring-inset ring-yellow-200">
        🟢 {dias}d restantes
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-200">
      ✓ {dias}d restantes
    </span>
  )
}
