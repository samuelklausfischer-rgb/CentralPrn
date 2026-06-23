import { fmt, fmtPct } from '../utils/format.js'
import { isoParaBR } from '../utils/dates.js'

function pctAtraso(row) {
  const r = Number(row.a_receber || 0)
  return r > 0 ? (Number(row.a_receber_atraso || 0) / r) * 100 : 0
}

function CardPonto({ rotulo, ponto, hoje, tipo = 'moeda' }) {
  const fmtV = tipo === 'pct' ? fmtPct : fmt
  const delta = hoje - ponto
  const pct = ponto !== 0 ? (delta / Math.abs(ponto)) * 100 : null
  const seta = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className="mt-0.5 text-lg font-bold text-gray-900">{fmtV(ponto)}</p>
      <p className="text-[11px] text-gray-400">
        Hoje: {fmtV(hoje)} <span className="text-gray-500">{seta}{pct == null ? '' : ` ${Math.round(Math.abs(pct))}%`}</span>
      </p>
    </div>
  )
}

// Cards B — posição completa no ponto analisado (clicado ou início do período) + Δ vs hoje
export default function PosicaoPonto({ pontoRow, hoje, data, ehClique }) {
  if (!pontoRow) return null
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-700">Posição em {isoParaBR(data)}</span>
        <span className="text-[11px] text-gray-400">{ehClique ? '(ponto selecionado)' : '(início do período)'}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CardPonto rotulo="Caixa" ponto={Number(pontoRow.caixa)} hoje={hoje.caixa} />
        <CardPonto rotulo="A receber" ponto={Number(pontoRow.a_receber)} hoje={hoje.aReceber} />
        <CardPonto rotulo="A pagar" ponto={Number(pontoRow.a_pagar)} hoje={hoje.aPagar} />
        <CardPonto rotulo="% em atraso" ponto={pctAtraso(pontoRow)} hoje={hoje.pctInad} tipo="pct" />
      </div>
    </div>
  )
}
