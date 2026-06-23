export default function SearchBar({ value, onChange, placeholder = 'Buscar...' }) {
  return (
    <div className="relative">
      <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-4 text-sm
                   shadow-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none
                   focus:ring-1 focus:ring-blue-500"
      />
    </div>
  )
}
