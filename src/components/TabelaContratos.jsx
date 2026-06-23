import { fmt, fmtBig, fmtPct } from '../utils/format.js'

// Cabeçalho clicável p/ ordenar. k = chave de ordenação; ativa mostra a seta.
function Th({ label, k, sortKey, sortDir, onSort, align = 'right' }) {
  const ativo = sortKey === k
  return (
    <th
      onClick={() => onSort && onSort(k)}
      className={`py-2 px-3 font-medium select-none ${onSort ? 'cursor-pointer hover:text-gray-700' : ''} ${align === 'right' ? 'text-right' : 'text-left'} ${ativo ? 'text-[#0D2B55]' : ''}`}
    >
      {label}{ativo ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )
}

// Tabela de contratos/financiamentos reconstruídos das parcelas em aberto.
// Ordenável (onSort) e com badge de empresa no consolidado.
export default function TabelaContratos({ contratos, mostrarEmpresa = false, sortKey = 'quitacao', sortDir = 'asc', onSort }) {
  if (!contratos || contratos.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">Nenhum contrato encontrado para este filtro.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-[11px] uppercase tracking-wide text-gray-400">
            <th className="py-2 pr-3 font-medium">Fornecedor / Categoria</th>
            <Th label="Parcela" k="parcela" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Progresso" k="quitado" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="left" />
            <Th label="Saldo devedor" k="saldo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Quitação prev." k="quitacao" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <Th label="Próx. venc." k="proxvenc" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {contratos.map((c) => {
            const pct = c.pctQuitado != null ? Math.min(100, Math.max(0, c.pctQuitado)) : null
            return (
              <tr key={c.chave} className="hover:bg-gray-50">
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    {mostrarEmpresa && (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.empresa === 'medimagem' ? 'bg-blue-50 text-[#0D2B55]' : 'bg-orange-50 text-orange-700'}`}>
                        {c.empresa === 'medimagem' ? 'MED' : 'PRN'}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-800" title={c.fornecedor}>{c.fornecedor}</p>
                      <p className="truncate text-[11px] text-gray-400" title={c.categoria}>{c.categoria}</p>
                    </div>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  <p className="font-medium text-gray-800">{fmt(c.valorParcela)}</p>
                  <p className="text-[11px] text-gray-400">{c.parcTotal}x</p>
                </td>
                <td className="py-2.5 px-3" style={{ minWidth: 130 }}>
                  {pct != null ? (
                    <>
                      <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                        <span>{c.parcelasPagas}/{c.parcTotal} pagas</span>
                        <span className="font-medium">{fmtPct(pct)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div className="h-1.5 rounded-full bg-[#16a34a]" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-400">{c.parcelasRestantes} restantes</p>
                    </>
                  ) : (
                    <span className="text-[11px] text-gray-400">Avulso</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-gray-900">{fmtBig(c.saldoRestante)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums text-gray-600">{c.quitacaoPrevista || '—'}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">
                  {c.atrasadas > 0 ? (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                      {c.atrasadas} atrasada{c.atrasadas !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-gray-600">{c.proximoVenc || '—'}</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
