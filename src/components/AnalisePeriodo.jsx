import { fmtBig, fmtPct } from '../utils/format.js'
import { isoParaBR } from '../utils/dates.js'
import { getMetrica } from '../utils/metricas.js'
import { estatisticasPeriodo } from '../utils/aggregators.js'

function Tile({ rotulo, valor, detalhe }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{rotulo}</p>
      <p className="mt-0.5 text-base font-bold text-gray-900">{valor}</p>
      {detalhe && <p className="text-[11px] text-gray-400">{detalhe}</p>}
    </div>
  )
}

// Cards A — análise da métrica selecionada no período (Variação como herói + pico/vale/média)
export default function AnalisePeriodo({ janela, metrica }) {
  const m = getMetrica(metrica)
  const fmtV = m.tipo === 'pct' ? fmtPct : fmtBig
  const est = estatisticasPeriodo(janela, m.get)

  if (!est || janela.length < 2) {
    return <p className="text-sm text-gray-400">Selecione um período maior para analisar a evolução de {m.label.toLowerCase()}.</p>
  }

  const subiu = est.delta > 0
  const flat = est.delta === 0
  let corVar = 'text-gray-700', corBorda = 'border-gray-200 bg-white'
  if (!flat && m.bomQuando === 'subir') { corVar = subiu ? 'text-green-700' : 'text-red-700'; corBorda = subiu ? 'border-green-200 bg-green-50/40' : 'border-red-200 bg-red-50/40' }
  else if (!flat && m.bomQuando === 'cair') { corVar = subiu ? 'text-red-700' : 'text-green-700'; corBorda = subiu ? 'border-red-200 bg-red-50/40' : 'border-green-200 bg-green-50/40' }
  const seta = flat ? '→' : subiu ? '↑' : '↓'
  const pctTxt = est.pct == null ? '' : `${est.pct > 0 ? '+' : ''}${Math.round(est.pct)}%`
  const sinal = m.tipo === 'moeda' && subiu ? '+' : ''

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <div className={`rounded-xl border-2 p-4 ${corBorda}`}>
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Variação · {m.label}</p>
        <p className={`mt-1 text-2xl font-bold ${corVar}`}>{seta} {sinal}{fmtV(est.delta)}</p>
        <p className="mt-0.5 text-[11px] text-gray-400">{pctTxt && `${pctTxt} no período · `}{isoParaBR(est.inicio.data)} → {isoParaBR(est.fim.data)}</p>
      </div>
      <div className="grid grid-cols-3 gap-3 lg:col-span-2">
        <Tile rotulo="Pico (maior)" valor={fmtV(est.pico.v)} detalhe={isoParaBR(est.pico.data)} />
        <Tile rotulo="Vale (menor)" valor={fmtV(est.vale.v)} detalhe={isoParaBR(est.vale.data)} />
        <Tile rotulo="Média do período" valor={fmtV(est.media)} detalhe={`${janela.length} dias`} />
      </div>
    </div>
  )
}
