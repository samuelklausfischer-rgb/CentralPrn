import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot } from 'recharts'
import { fmt, fmtCompact } from '../utils/format.js'
import { useLargura } from '../hooks/useLargura.js'

function TooltipProj({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-gray-800">{d.dia}</p>
      <p className="text-green-700">Entra: {fmt(d.receber)}</p>
      <p className="text-orange-700">Sai: {fmt(d.pagar)}</p>
      <p className={`mt-0.5 font-medium ${d.saldo < 0 ? 'text-red-700' : 'text-[#0D2B55]'}`}>Saldo: {fmt(d.saldo)}</p>
    </div>
  )
}

// Projeção de saldo (fluxoCaixa da Omie) — área verde/vermelha no zero, marcadores Hoje e Dia-D
export default function ProjecaoCaixa({ fluxo }) {
  const [ref, largura] = useLargura()
  if (!fluxo || fluxo.length === 0) return null

  const data = fluxo.map((d) => ({
    iso: d.dDia,
    dia: d.dDia.slice(0, 5),
    saldo: Number(d.vSaldo),
    receber: Number(d.vReceber),
    pagar: Number(d.vPagar),
  }))

  const vals = data.map((d) => d.saldo)
  const dataMax = Math.max(...vals)
  const dataMin = Math.min(...vals)
  const off = dataMax <= 0 ? 0 : dataMin >= 0 ? 1 : dataMax / (dataMax - dataMin)

  const hojePt = data[0]
  const diaD = data.find((d) => d.saldo < 0)

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      <AreaChart width={largura} height={270} data={data} margin={{ top: 24, right: 16, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
            <stop offset={off} stopColor="#16a34a" stopOpacity={0.35} />
            <stop offset={off} stopColor="#A32D2D" stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
        <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} width={70} />
        <Tooltip content={<TooltipProj />} />
        <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="4 3" />
        <Area type="monotone" dataKey="saldo" stroke="#0D2B55" strokeWidth={2} fill="url(#gradSaldo)" dot={{ r: 2.5, fill: '#0D2B55' }} activeDot={{ r: 5 }} />
        {hojePt && (
          <ReferenceDot x={hojePt.dia} y={hojePt.saldo} r={5} fill="#0D2B55" stroke="#fff" strokeWidth={2}
            label={{ value: 'Hoje', position: 'top', fontSize: 11, fill: '#0D2B55' }} />
        )}
        {diaD && (
          <ReferenceDot x={diaD.dia} y={diaD.saldo} r={5} fill="#A32D2D" stroke="#fff" strokeWidth={2}
            label={{ value: `Zera em ${diaD.iso.slice(0, 5)}`, position: 'bottom', fontSize: 11, fill: '#A32D2D' }} />
        )}
      </AreaChart>
    </div>
  )
}
