// Formatação compartilhada (pt-BR / BRL)

export function fmt(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Sem centavos — para os números dominantes
export function fmtBig(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function fmtPct(val, dec = 0) {
  return `${Number(val || 0).toFixed(dec).replace('.', ',')}%`
}

export function fmtNum(val) {
  return Number(val || 0).toLocaleString('pt-BR')
}

// Compacto para eixos/labels: "R$ 1,2 mi" / "R$ 850 mil" / "R$ 320"
export function fmtCompact(val) {
  const n = Number(val || 0)
  const abs = Math.abs(n)
  const sinal = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sinal}R$ ${(abs / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (abs >= 1_000) return `${sinal}R$ ${(abs / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
  return `${sinal}R$ ${abs.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`
}
