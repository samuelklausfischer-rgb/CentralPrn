import { fmtBig, fmtPct } from '../utils/format.js'
import { IconeTendencia } from './icones.jsx'

// Card-herói: o veredito do período (lucro/prejuízo) grande + margem ao lado.
export default function ResultadoHero({ dre, periodoFrase, ehMesVigente }) {
  if (!dre) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500">
          <IconeTendencia className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-gray-600">Ainda não há resultado fechado para {periodoFrase || 'este período'}.</p>
      </div>
    )
  }

  const lucro = dre.resultado >= 0
  const ctx = ehMesVigente ? `Em ${periodoFrase}` : `No acumulado ${periodoFrase}`
  const tom = lucro
    ? { card: 'border-green-200 bg-green-50', icon: 'bg-green-600', frase: 'text-green-700', num: 'text-green-800', mLabel: 'text-green-700', mNum: 'text-green-800' }
    : { card: 'border-red-200 bg-red-50', icon: 'bg-red-600', frase: 'text-red-600', num: 'text-red-700', mLabel: 'text-red-600', mNum: 'text-red-700' }

  return (
    <div className={`flex flex-wrap items-center gap-4 rounded-xl border p-5 ${tom.card}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white ${tom.icon}`}>
        <IconeTendencia className={`h-6 w-6 ${lucro ? '' : '-scale-y-100'}`} />
      </div>
      <div className="flex-1 min-w-[180px]">
        <p className={`text-sm ${tom.frase}`}>
          {ctx}, sua empresa {lucro ? 'teve lucro' : 'teve prejuízo'}
        </p>
        <p className={`mt-0.5 text-4xl font-bold ${tom.num}`}>{fmtBig(dre.resultado)}</p>
        <p className="mt-0.5 text-[11px] text-gray-400">Resultado por competência — não é o dinheiro que entrou na conta</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-2xl font-bold ${tom.mNum}`}>{dre.margem != null ? fmtPct(dre.margem, 1) : '—'}</p>
        <p className={`text-[11px] ${tom.mLabel}`}>de margem</p>
      </div>
    </div>
  )
}
