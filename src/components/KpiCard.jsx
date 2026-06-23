import Sparkline from './Sparkline.jsx'

const TONES = {
  neutral: { card: 'border-gray-100 bg-white', val: 'text-gray-900' },
  green:   { card: 'border-green-100 bg-green-50', val: 'text-green-800' },
  red:     { card: 'border-red-200 bg-red-50', val: 'text-red-700' },
  orange:  { card: 'border-orange-200 bg-orange-50', val: 'text-orange-700' },
  blue:    { card: 'border-blue-100 bg-blue-50', val: 'text-[#0D2B55]' },
}

// trend: { delta, pct, bomQuando: 'subir' | 'cair' | null }
function TrendLine({ trend }) {
  const flat = trend.delta === 0
  const up = trend.delta > 0
  let cls = 'text-gray-500'
  if (!flat && trend.bomQuando === 'subir') cls = up ? 'text-green-600' : 'text-red-600'
  else if (!flat && trend.bomQuando === 'cair') cls = up ? 'text-red-600' : 'text-green-600'
  const arrow = flat ? '→' : up ? '↑' : '↓'
  const pctTxt = trend.pct == null ? '' : ` ${trend.pct > 0 ? '+' : ''}${Math.round(trend.pct)}%`
  return (
    <p className={`mt-1 text-xs font-medium ${cls}`}>
      {arrow}{pctTxt} <span className="font-normal text-gray-400">{trend.label ?? 'vs mês anterior'}</span>
    </p>
  )
}

const STATUS_COR = { bom: 'text-green-500', atencao: 'text-orange-500', ruim: 'text-red-500' }

export default function KpiCard({ label, valor, sub, tone = 'neutral', big = false, trend = null, sparkData = null, sparkColor = '#0D2B55', icon: Icon = null, status = null }) {
  const t = TONES[tone] ?? TONES.neutral
  return (
    <div className={`relative rounded-xl border p-4 shadow-sm ${t.card}`}>
      {status && <span className={`absolute right-3 top-3 text-base leading-none ${STATUS_COR[status] ?? ''}`} aria-hidden="true">●</span>}
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-gray-400" />}
        {label}
      </p>
      <p className={`mt-1 font-bold ${big ? 'text-4xl' : 'text-2xl'} ${t.val}`}>{valor}</p>
      {trend && <TrendLine trend={trend} />}
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      {sparkData && sparkData.length > 1 && (
        <div className="mt-2 -mb-1">
          <Sparkline data={sparkData} color={sparkColor} />
        </div>
      )}
    </div>
  )
}
