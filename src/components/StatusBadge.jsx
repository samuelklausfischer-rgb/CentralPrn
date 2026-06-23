export default function StatusBadge({ cod }) {
  const map = {
    '0':  { label: 'Em Elaboração', cls: 'bg-blue-100   text-blue-700   ring-blue-200'   },
    '00': { label: 'Em Elaboração', cls: 'bg-blue-100   text-blue-700   ring-blue-200'   },
    '10': { label: 'Ativo',         cls: 'bg-green-100  text-green-800  ring-green-200'  },
    '20': { label: 'Ag. Aprovação', cls: 'bg-purple-100 text-purple-700 ring-purple-200' },
    '50': { label: 'Suspenso',      cls: 'bg-yellow-100 text-yellow-800 ring-yellow-200' },
    '60': { label: 'Encerrado',     cls: 'bg-gray-100   text-gray-600   ring-gray-200'   },
    '90': { label: 'Vencido',       cls: 'bg-red-100    text-red-700    ring-red-200'    },
    '99': { label: 'Cancelado',     cls: 'bg-gray-100   text-gray-600   ring-gray-300'   },
  }
  const { label, cls } = map[String(cod)] ?? { label: `Sit. ${cod}`, cls: 'bg-yellow-100 text-yellow-800 ring-yellow-200' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  )
}
