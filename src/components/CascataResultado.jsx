import { useState } from 'react'
import { fmt } from '../utils/format.js'
import {
  IconeFaturamento, IconeImposto, IconeLiquida, IconeCustos,
  IconeDespesas, IconeResultado, IconeChevron,
} from './icones.jsx'

// Uma etapa do fluxo. Expansível quando recebe `itens` (subcategorias).
function Etapa({ Icone, corQuadrado, rotulo, sub, valor, sinal, tomValor, itens, destaque, fundoClasse }) {
  const [aberto, setAberto] = useState(false)
  const expansivel = !!(itens && itens.length > 0)
  const sinalTxt = sinal === '-' ? '− ' : sinal === '+' ? '+ ' : ''

  const linha = (
    <div className="flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${corQuadrado}`}>
        <Icone className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className={`text-sm ${destaque ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{sinal === '=' ? '= ' : ''}{rotulo}</p>
        {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
      </div>
      {expansivel
        ? <IconeChevron className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        : <span className="w-4 shrink-0" />}
      <span className={`shrink-0 tabular-nums text-sm ${destaque ? 'font-bold' : 'font-medium'} ${tomValor}`}>
        {sinalTxt}{fmt(Math.abs(valor))}
      </span>
    </div>
  )

  const wrapper = destaque
    ? `my-1.5 rounded-lg px-3 py-2.5 ${fundoClasse}`
    : 'border-t border-gray-100 py-2.5'

  return (
    <div>
      {expansivel ? (
        <button type="button" onClick={() => setAberto((o) => !o)} aria-expanded={aberto}
          className={`block w-full transition-colors hover:bg-gray-50/60 ${wrapper}`}>
          {linha}
        </button>
      ) : (
        <div className={wrapper}>{linha}</div>
      )}
      {expansivel && aberto && (
        <div className="mb-2 mt-1 ml-12 flex flex-col gap-1.5">
          {itens.map((it) => (
            <div key={it.nome} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500">{it.nome}</span>
              <span className="tabular-nums font-medium text-gray-600">{fmt(it.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// A jornada do dinheiro: bruto → impostos → líquida → custos → despesas → (outras) → resultado.
// O número grande do resultado e a margem ficam no ResultadoHero — aqui é o fluxo.
export default function CascataResultado({ cascata, titulo, subtitulo }) {
  if (!cascata) return null
  const c = cascata
  const lucro = c.resultado >= 0

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{titulo}</h2>
      {subtitulo && <p className="mb-2 text-xs text-gray-400">{subtitulo}</p>}

      <Etapa Icone={IconeFaturamento} corQuadrado="bg-green-50 text-green-700"
        rotulo="Faturamento bruto" sub="tudo que você faturou" valor={c.faturBruto} sinal="+" tomValor="text-green-700" />

      {c.impostosDeducoes > 0 && (
        <Etapa Icone={IconeImposto} corQuadrado="bg-gray-100 text-gray-500"
          rotulo="Impostos e deduções" sub="impostos sobre o faturamento" valor={c.impostosDeducoes} sinal="-" tomValor="text-red-600" itens={c.impostosItens} />
      )}

      <Etapa Icone={IconeLiquida} corQuadrado="bg-blue-50 text-[#0D2B55]"
        rotulo="Receita líquida" sub="o que sobra depois dos impostos" valor={c.liquida} sinal="=" tomValor="text-gray-900" destaque fundoClasse="bg-gray-50" />

      {c.custos > 0 && (
        <Etapa Icone={IconeCustos} corQuadrado="bg-amber-50 text-amber-600"
          rotulo="Custos dos serviços" sub="custo direto para entregar" valor={c.custos} sinal="-" tomValor="text-red-600" />
      )}

      {c.despesas > 0 && (
        <Etapa Icone={IconeDespesas} corQuadrado="bg-orange-50 text-[#D85A30]"
          rotulo="Despesas para tocar a empresa" sub="fixas e variáveis" valor={c.despesas} sinal="-" tomValor="text-red-600" itens={c.despesasItens} />
      )}

      {c.extras > 0 && (
        <Etapa Icone={IconeResultado} corQuadrado="bg-green-50 text-green-700"
          rotulo="Outras receitas" sub="receitas financeiras e afins" valor={c.extras} sinal="+" tomValor="text-green-700" itens={c.extrasItens} />
      )}

      <Etapa Icone={IconeResultado} corQuadrado={lucro ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}
        rotulo={lucro ? 'Resultado do mês — lucro' : 'Resultado do mês — prejuízo'} sub="o que de fato sobrou"
        valor={c.resultado} sinal="=" tomValor={lucro ? 'text-green-700' : 'text-red-700'}
        destaque fundoClasse={lucro ? 'bg-green-50' : 'bg-red-50'} />
    </div>
  )
}
