// Mini-linha de tendência, SVG puro (sem libs)
export default function Sparkline({ data, color = '#0D2B55', width = 130, height = 34 }) {
  if (!data || data.length < 2) return null
  const pad = 3
  const vals = data.map(Number)
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  const span = max - min || 1
  const x = (i) => pad + (i / (vals.length - 1)) * (width - pad * 2)
  const y = (v) => pad + (1 - (v - min) / span) * (height - pad * 2)
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const lastX = x(vals.length - 1)
  const lastY = y(vals[vals.length - 1])
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  )
}
