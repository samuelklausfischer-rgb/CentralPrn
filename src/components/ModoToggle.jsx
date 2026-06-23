const MODOS = [
  { key: 'simples',  label: 'Simples'  },
  { key: 'avancado', label: 'Avançado' },
]

// Alterna entre a visão resumida (Simples) e o cockpit completo (Avançado).
export default function ModoToggle({ valor, onChange }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 p-0.5 w-fit">
      {MODOS.map((m) => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
            valor === m.key ? 'bg-[#F26522] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
