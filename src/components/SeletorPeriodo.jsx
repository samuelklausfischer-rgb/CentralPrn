export const PERIODOS = [
  { key: 'hoje',  label: 'Hoje',     dias: 0 },
  { key: 'ontem', label: 'Ontem',    dias: 1 },
  { key: '7d',    label: '7 dias',   dias: 7 },
  { key: '15d',   label: '15 dias',  dias: 15 },
  { key: '1m',    label: '1 mês',    dias: 30 },
  { key: '2m',    label: '2 meses',  dias: 60 },
  { key: '3m',    label: '3 meses',  dias: 90 },
  { key: '6m',    label: '6 meses',  dias: 180 },
  { key: '1a',    label: '1 ano',    dias: 365 },
]

export default function SeletorPeriodo({ valor, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {PERIODOS.map((p) => {
        const ativo = p.key === valor
        return (
          <button
            key={p.key}
            onClick={() => onChange(p.key)}
            aria-pressed={ativo}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              ativo
                ? 'bg-[#F26522] text-white'
                : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
