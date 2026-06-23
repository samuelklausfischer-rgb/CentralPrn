// Barra divergente (zero no centro) — para o Ciclo financeiro, que pode ser negativo.
// Negativo = recebe antes de pagar (verde, saudável). Positivo = financia a operação.
export default function MiniBarraDivergente({ valor, escala = 60, rotulo, frase, Icone }) {
  const indisponivel = valor == null
  const f = indisponivel ? 0 : Math.max(-1, Math.min(1, valor / escala))
  const neg = valor < 0
  const cor = indisponivel ? '#9CA3AF' : neg ? '#16a34a' : valor > 30 ? '#A32D2D' : '#EF9F27'
  const larg = Math.abs(f) * 50 // % de cada metade
  const texto = indisponivel ? '—' : `${valor > 0 ? '+' : ''}${valor}d`

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
        {Icone && <Icone className="h-4 w-4 shrink-0 text-gray-400" />}{rotulo}
      </p>
      <p className="mt-1 text-2xl font-bold leading-none" style={{ color: cor }}>{texto}</p>
      <div className="relative mt-3 h-2.5 rounded-full bg-gray-100">
        <div className="absolute left-1/2 top-[-2px] h-[14px] w-px bg-gray-300" />
        {!indisponivel && (
          <div className="absolute top-0 h-full rounded-full" style={{ backgroundColor: cor, width: `${larg}%`, left: neg ? `${50 - larg}%` : '50%' }} />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>recebe antes</span>
        <span>financia a operação</span>
      </div>
      {frase && <p className="mt-2 text-[11px] text-gray-500">{frase}</p>}
    </div>
  )
}
