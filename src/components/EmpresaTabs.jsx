const EMPRESAS = [
  { key: 'prn',         label: 'PRN'         },
  { key: 'medimagem',   label: 'MedImagem'   },
  { key: 'consolidado', label: 'Consolidado' },
]

// Seletor de empresa: PRN | MedImagem | Consolidado
// Props: value (key ativo), onChange (fn)
export default function EmpresaTabs({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 p-0.5 w-fit">
      {EMPRESAS.map((e) => (
        <button
          key={e.key}
          onClick={() => onChange(e.key)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            value === e.key
              ? 'bg-[#F26522] text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {e.label}
        </button>
      ))}
    </div>
  )
}
