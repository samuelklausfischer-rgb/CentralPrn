import { fmt } from '../utils/format.js'

const R = 54
const C = 2 * Math.PI * R // circunferência ≈ 339.29
const STROKE = 15

// Donut "para onde vai cada R$ 100 faturados". SVG puro (sem libs), mesma filosofia do Sparkline.
export default function RoscaComposicao({ cascata }) {
  if (!cascata || cascata.faturBruto <= 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Para onde vai cada R$ 100 faturados</h2>
        <p className="mt-2 text-sm text-gray-400">Sem faturamento no período para calcular.</p>
      </div>
    )
  }

  const base = cascata.faturBruto
  const sobra = base - cascata.impostosDeducoes - cascata.custos - cascata.despesas
  const lucro = sobra >= 0
  const custoTotal = cascata.impostosDeducoes + cascata.custos + cascata.despesas
  // denom garante que o arco nunca ultrapasse o círculo (caso de prejuízo: custos > faturamento)
  const denom = Math.max(base, custoTotal) || 1

  const segs = [
    { nome: 'Despesas', valor: cascata.despesas, cor: '#D85A30' },
    { nome: 'Custos dos serviços', valor: cascata.custos, cor: '#EF9F27' },
    { nome: lucro ? 'Sobrou (lucro)' : 'Faltou (prejuízo)', valor: Math.max(sobra, 0), cor: lucro ? '#639922' : '#A32D2D' },
    { nome: 'Impostos e deduções', valor: cascata.impostosDeducoes, cor: '#B4B2A9' },
  ]

  let acc = 0
  const arcs = segs.map((s) => {
    const len = (s.valor / denom) * C
    const arc = { cor: s.cor, len, offset: -acc }
    acc += len
    return arc
  })

  const por100 = (v) => fmt((v / base) * 100)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm flex flex-wrap items-center gap-6">
      <div className="relative h-32 w-32 shrink-0">
        <svg viewBox="0 0 120 120" className="h-32 w-32" aria-hidden="true">
          <g transform="rotate(-90 60 60)" fill="none" strokeWidth={STROKE}>
            <circle cx="60" cy="60" r={R} stroke="#F1EFE8" />
            {arcs.map((a, i) => (
              a.len > 0.5 && (
                <circle key={i} cx="60" cy="60" r={R} stroke={a.cor}
                  strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={a.offset} />
              )
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className={`text-lg font-bold ${lucro ? 'text-green-700' : 'text-red-700'}`}>
            {lucro ? '' : '−'}{fmt(Math.abs(sobra) / base * 100)}
          </span>
          <span className="text-[10px] leading-tight text-gray-400">{lucro ? 'sobra de' : 'falta de'}<br />cada R$ 100</span>
        </div>
      </div>

      <div className="min-w-[200px] flex-1">
        <h2 className="text-base font-semibold text-gray-900">Para onde vai cada R$ 100 faturados</h2>
        <p className="mb-3 text-xs text-gray-400">Como se divide o que você faturou no período</p>
        <div className="flex flex-col gap-2 text-sm">
          <LinhaLegenda cor="#D85A30" nome="Despesas" valor={por100(cascata.despesas)} />
          <LinhaLegenda cor="#EF9F27" nome="Custos dos serviços" valor={por100(cascata.custos)} />
          <LinhaLegenda cor={lucro ? '#639922' : '#A32D2D'} nome={lucro ? 'Sobrou (lucro)' : 'Faltou (prejuízo)'} valor={por100(Math.abs(sobra))} forte cor2={lucro ? 'text-green-700' : 'text-red-700'} />
          <LinhaLegenda cor="#B4B2A9" nome="Impostos e deduções" valor={por100(cascata.impostosDeducoes)} />
        </div>
      </div>
    </div>
  )
}

function LinhaLegenda({ cor, nome, valor, forte, cor2 }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: cor }} />
      <span className="flex-1 text-gray-600">{nome}</span>
      <span className={`font-semibold tabular-nums ${forte ? cor2 : 'text-gray-700'}`}>{valor}</span>
    </div>
  )
}
