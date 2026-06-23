// Helpers de data — Omie usa dd/mm/aaaa

export function toBR(d) {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function hojeBR() {
  return toBR(new Date())
}

export function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function mesISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function parseOmieDate(str) {
  if (!str || str === '—') return null
  const [dd, mm, yyyy] = str.split('/')
  if (!dd || !mm || !yyyy) return null
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
}

// Dias entre duas datas Omie (dd/mm/aaaa)
export function diasEntre(aStr, bStr) {
  const a = parseOmieDate(aStr), b = parseOmieDate(bStr)
  if (!a || !b) return null
  return Math.round((b - a) / 86400000)
}

// Data ISO (yyyy-mm-dd) de N dias atrás a partir de hoje
export function isoNDiasAtras(n) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 'yyyy-mm-dd' -> 'dd/mm/aaaa' para exibição
export function isoParaBR(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Retorna as últimas N datas de fim de mês em ISO (yyyy-mm-dd), mais recente primeiro.
// Útil para backfill de snapshots mensais.
export function ultimasNFimDeMes(n) {
  const datas = []
  for (let m = 1; m <= n; m++) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - m + 1)
    d.setDate(0)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    datas.push(iso)
  }
  return datas
}
