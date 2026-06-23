import { IconeNotaOk, IconeAlerta, IconeEscudo } from './icones.jsx'

const NIVEL_ORD = { bom: 0, atencao: 1, ruim: 2 }
const GLIFO_COR = { bom: 'text-green-500', atencao: 'text-orange-500', ruim: 'text-red-500', ignorado: 'text-gray-300' }

// Faixa de veredito de saúde no topo. A classificação (null-safe) vem de classificarSaude.
export default function FaixaSaude({ sinais }) {
  const ativos = (sinais || []).filter((s) => s.nivel !== 'ignorado')
  const geral = ativos.reduce((pior, s) => (NIVEL_ORD[s.nivel] > NIVEL_ORD[pior] ? s.nivel : pior), 'bom')
  const semDados = ativos.length === 0

  const tema = semDados
    ? { card: 'border-gray-200 bg-gray-50', icon: 'bg-gray-300', titulo: 'text-gray-600', Icone: IconeEscudo, txt: 'Sinais insuficientes para avaliar a saúde' }
    : geral === 'ruim'
      ? { card: 'border-red-200 bg-red-50', icon: 'bg-red-600', titulo: 'text-red-700', Icone: IconeAlerta, txt: 'Saúde financeira: pontos críticos exigem atenção' }
      : geral === 'atencao'
        ? { card: 'border-orange-200 bg-orange-50', icon: 'bg-[#EF9F27]', titulo: 'text-orange-700', Icone: IconeAlerta, txt: 'Saúde financeira: atenção em alguns pontos' }
        : { card: 'border-green-200 bg-green-50', icon: 'bg-green-600', titulo: 'text-green-800', Icone: IconeEscudo, txt: 'Saúde financeira: tudo no azul' }

  const { Icone } = tema

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${tema.card}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white ${tema.icon}`}>
        <Icone className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${tema.titulo}`}>{tema.txt}</p>
        {sinais && sinais.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sinais.map((s) => (
              <span key={s.chave} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] text-gray-600 ring-1 ring-inset ring-gray-200">
                <span className={GLIFO_COR[s.nivel]} aria-hidden="true">●</span>{s.texto}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
