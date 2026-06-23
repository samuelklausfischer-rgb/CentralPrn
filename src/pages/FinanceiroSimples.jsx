import SeletorPeriodo from '../components/SeletorPeriodo.jsx'
import ResultadoHero from '../components/ResultadoHero.jsx'
import CascataResultado from '../components/CascataResultado.jsx'
import RoscaComposicao from '../components/RoscaComposicao.jsx'
import { fmtBig } from '../utils/format.js'
import { derivarCascata } from '../utils/financeiro.js'
import { IconeCaixa, IconeNotaOk, IconeRelogio, IconeNotaX } from '../components/icones.jsx'

function Skeleton({ h = 'h-40' }) {
  return <div className={`animate-pulse rounded-xl bg-gray-100 ${h}`} />
}

function NotaCard({ Icone, cor, titulo, valor, sub }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icone className={`h-5 w-5 ${cor}`} />
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</span>
      </div>
      <p className="mt-2 text-xl font-bold text-gray-900">{valor}</p>
      <p className="text-[11px] text-gray-400">{sub}</p>
    </div>
  )
}

// Visão SIMPLES redesenhada — apresentacional. Recebe dados já derivados de Financeiro.jsx.
export default function FinanceiroSimples({ periodo, setPeriodo, drePeriodo, caixaHoje, faturamento }) {
  const cascata = derivarCascata(drePeriodo.dre)
  const subtitulo = drePeriodo.ehMesVigente
    ? 'Resultado do mês inteiro — o DRE é fechado por mês, não por dia.'
    : drePeriodo.capeado1a
      ? 'Soma dos meses fechados — janela de até 6 meses.'
      : 'Soma dos meses fechados no período.'

  return (
    <div>
      <SeletorPeriodo valor={periodo} onChange={setPeriodo} />

      {/* ── Território: RESULTADO (competência) ── */}
      <div className="mt-4 space-y-4">
        {drePeriodo.loading ? (
          <>
            <Skeleton h="h-[92px]" />
            <Skeleton h="h-80" />
          </>
        ) : drePeriodo.error && drePeriodo.retryAfter !== null ? (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-700">
            <span className="animate-pulse">⏱</span> Muitas consultas seguidas — tentando novamente em <span className="tabular-nums font-bold">{drePeriodo.retryAfter}s</span>
          </div>
        ) : drePeriodo.error ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">Não foi possível carregar o resultado: {drePeriodo.error}</p>
            <button onClick={drePeriodo.retry} className="shrink-0 rounded-md bg-[#0D2B55] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-900 transition-colors">↺ Tentar de novo</button>
          </div>
        ) : (
          <>
            <ResultadoHero dre={drePeriodo.dre} periodoFrase={drePeriodo.periodoFrase} ehMesVigente={drePeriodo.ehMesVigente} />
            {cascata && <CascataResultado cascata={cascata} titulo={drePeriodo.rotulo} subtitulo={subtitulo} />}
            {cascata && <RoscaComposicao cascata={cascata} />}
          </>
        )}
      </div>

      {/* ── Território: DINHEIRO (caixa) ── */}
      <div className="my-8 border-t border-gray-200" />
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 h-5 w-[3px] shrink-0 rounded-full bg-[#0D2B55]" />
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[#0D2B55]">Dinheiro na conta</h2>
          <p className="mt-0.5 text-[11px] text-gray-400">Quanto há em caixa agora e o que foi faturado no período</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0D2B55] text-white">
            <IconeCaixa className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[#185FA5]">Dinheiro em caixa hoje</p>
            <p className="text-3xl font-bold text-[#0D2B55]">{fmtBig(caixaHoje)}</p>
            <p className="mt-0.5 text-[11px] text-gray-500">Lucro não é o mesmo que dinheiro em caixa — clientes podem ainda não ter pago.</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Notas fiscais emitidas — {faturamento.intervalo}</p>
          {faturamento.loading ? (
            <Skeleton h="h-24" />
          ) : faturamento.error ? (
            <p className="text-xs text-red-500">Faturamento indisponível: {faturamento.error}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NotaCard Icone={IconeNotaOk} cor="text-green-700" titulo="Faturado" valor={fmtBig(faturamento.vFaturadas)} sub={`${faturamento.nFaturadas} nota${faturamento.nFaturadas !== 1 ? 's' : ''} emitida${faturamento.nFaturadas !== 1 ? 's' : ''}`} />
              <NotaCard Icone={IconeRelogio} cor="text-amber-600" titulo="Aguardando" valor={fmtBig(faturamento.vPendentes)} sub="notas a receber" />
              <NotaCard Icone={IconeNotaX} cor={faturamento.vCanceladas > 0 ? 'text-red-600' : 'text-gray-400'} titulo="Cancelado" valor={fmtBig(faturamento.vCanceladas)} sub={`${faturamento.nCanceladas} nota${faturamento.nCanceladas !== 1 ? 's' : ''} cancelada${faturamento.nCanceladas !== 1 ? 's' : ''}`} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
