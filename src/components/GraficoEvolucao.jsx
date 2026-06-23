import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot } from 'recharts'
import { fmt, fmtPct, fmtCompact } from '../utils/format.js'
import { METRICAS, getMetrica } from '../utils/metricas.js'
import { estatisticasPeriodo } from '../utils/aggregators.js'
import { useLargura } from '../hooks/useLargura.js'

const diaBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

function Toggle({ metrica, onMetricaChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {METRICAS.map((x) => (
        <button
          key={x.key}
          onClick={() => onMetricaChange(x.key)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            metrica === x.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {x.label}
        </button>
      ))}
    </div>
  )
}

function makeTooltip(m) {
  const fmtV = m.tipo === 'pct' ? fmtPct : fmt
  return function TooltipEvol({ active, payload }) {
    if (!active || !payload || !payload.length) return null
    const d = payload[0].payload
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
        <p className="font-semibold text-gray-800">{diaBR(d.iso)}</p>
        <p style={{ color: m.cor }}>{m.label}: {fmtV(d.v)}</p>
      </div>
    )
  }
}

export default function GraficoEvolucao({ data, metrica, onMetricaChange, onPickDate, refDate }) {
  const m = getMetrica(metrica)
  const [ref, largura] = useLargura()

  if (!data || data.length < 2) {
    return (
      <div>
        <Toggle metrica={metrica} onMetricaChange={onMetricaChange} />
        <p className="py-10 text-center text-sm text-gray-400">Selecione um período maior para ver a evolução.</p>
      </div>
    )
  }

  const chart = data.map((r) => ({ iso: r.data, v: m.get(r) }))
  const vals = chart.map((d) => d.v)
  const dataMin = Math.min(...vals)
  const dataMax = Math.max(...vals)
  const hasNeg = dataMin < 0
  const off = dataMax <= 0 ? 0 : dataMin >= 0 ? 1 : dataMax / (dataMax - dataMin)

  const est = estatisticasPeriodo(data, m.get)
  const fmtAxis = m.tipo === 'pct' ? (v) => `${Math.round(v)}%` : fmtCompact
  const TooltipEvol = makeTooltip(m)

  return (
    <div>
      <Toggle metrica={metrica} onMetricaChange={onMetricaChange} />
      <div ref={ref} className="mt-3 w-full overflow-x-auto">
        <AreaChart
          width={largura}
          height={250}
          data={chart}
          margin={{ top: 18, right: 16, left: 8, bottom: 4 }}
          onClick={(e) => { if (e && e.activePayload && e.activePayload[0]) onPickDate(e.activePayload[0].payload.iso) }}
        >
          <defs>
            <linearGradient id={`grad-${m.key}`} x1="0" y1="0" x2="0" y2="1">
              {hasNeg ? (
                <>
                  <stop offset={off} stopColor="#16a34a" stopOpacity={0.32} />
                  <stop offset={off} stopColor="#A32D2D" stopOpacity={0.32} />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor={m.cor} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={m.cor} stopOpacity={0.03} />
                </>
              )}
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="iso" tickFormatter={diaBR} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} minTickGap={24} />
          <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={64} />
          <Tooltip content={<TooltipEvol />} />
          {hasNeg && <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="4 3" />}
          <Area type="monotone" dataKey="v" stroke={hasNeg ? '#0D2B55' : m.cor} strokeWidth={2} fill={`url(#grad-${m.key})`} dot={false} activeDot={{ r: 5 }} style={{ cursor: 'pointer' }} />
          {est && <ReferenceDot x={est.pico.data} y={est.pico.v} r={4} fill="#16a34a" stroke="#fff" strokeWidth={1.5} label={{ value: 'Pico', position: 'top', fontSize: 10, fill: '#16a34a' }} />}
          {est && <ReferenceDot x={est.vale.data} y={est.vale.v} r={4} fill="#A32D2D" stroke="#fff" strokeWidth={1.5} label={{ value: 'Vale', position: 'bottom', fontSize: 10, fill: '#A32D2D' }} />}
          {refDate && chart.some((d) => d.iso === refDate) && (
            <ReferenceDot x={refDate} y={chart.find((d) => d.iso === refDate).v} r={6} fill="#F26522" stroke="#fff" strokeWidth={2} />
          )}
        </AreaChart>
      </div>
      <p className="mt-1 text-center text-xs text-gray-400">Clique em um ponto para ver a posição daquele dia</p>
    </div>
  )
}
