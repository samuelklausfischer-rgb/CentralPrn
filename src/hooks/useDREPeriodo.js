import { useState, useEffect, useCallback } from 'react'
import { omieClients, delay } from '../api/omie.js'
import { parseDRE, mergeDRE, resolverMesesPeriodo, periodoFraseDRE } from '../utils/financeiro.js'

function parseRetryAfter(message) {
  const m = String(message).match(/(\d+)\s*segundos/i)
  return m ? parseInt(m[1], 10) : null
}

// Mesmo formato de chave/envelope/TTL do useDRE → o cache de um mês é COMPARTILHADO
// entre os dois hooks (buscar o mês corrente aqui aproveita o que o cockpit já buscou).
const TTL = 5 * 60_000
const cacheKey = (empresa, ano, mes) => `omie_dre_${empresa}_${ano}_${mes}`

function getCache(empresa, ano, mes) {
  try {
    const raw = sessionStorage.getItem(cacheKey(empresa, ano, mes))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > TTL) return null
    return data
  } catch { return null }
}

function setCache(empresa, ano, mes, data) {
  try {
    sessionStorage.setItem(cacheKey(empresa, ano, mes), JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

// DRE somado ao longo dos meses calendário cobertos pelo período selecionado.
// periodo: key do PERIODOS ('hoje'|'7d'|...|'1a'). A resolução período→meses vive
// em utils/financeiro.js (resolverMesesPeriodo) para manter a regra num só lugar.
export function useDREPeriodo(empresa = 'prn', { enabled = true, periodo = '1m' } = {}) {
  const [dre, setDre]               = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [retryAfter, setRetryAfter] = useState(null)
  const [retryKey, setRetryKey]     = useState(0)

  const meses        = resolverMesesPeriodo(periodo)
  const ehMesVigente = meses.length === 1
  const periodoFrase = periodoFraseDRE(meses)
  const rotulo       = ehMesVigente ? `Resultado de ${periodoFrase}` : `Acumulado ${periodoFrase}`
  const capeado1a    = periodo === '1a'

  useEffect(() => {
    if (!retryAfter) return
    if (retryAfter <= 0) { setRetryAfter(null); setError(null); setLoading(true); setRetryKey((k) => k + 1); return }
    const id = setTimeout(() => setRetryAfter((s) => (s !== null ? s - 1 : null)), 1000)
    return () => clearTimeout(id)
  }, [retryAfter])

  const retry = useCallback(() => {
    setError(null); setRetryAfter(null); setLoading(true); setRetryKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const client = omieClients[empresa]
    const lista = resolverMesesPeriodo(periodo)

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const dresMes = []
        for (let i = 0; i < lista.length; i++) {
          const { nAno, nMes } = lista[i]
          let raw = getCache(empresa, nAno, nMes)
          if (!raw) {
            if (i > 0) await delay(400) // respiro entre meses (anti-425)
            raw = await client.fetchListarOrcamentos(nAno, nMes)
            if (cancelled) return
            setCache(empresa, nAno, nMes, raw)
          }
          dresMes.push(parseDRE(raw.ListaOrcamentos || []))
        }
        if (cancelled) return
        setDre(dresMes.reduce((acc, d) => mergeDRE(acc, d), null))
      } catch (err) {
        if (cancelled) return
        const sec = parseRetryAfter(err.message)
        setError(err.message)
        if (sec) setRetryAfter(sec)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [empresa, periodo, enabled, retryKey])

  return { dre, meses, rotulo, periodoFrase, ehMesVigente, capeado1a, loading, error, retry, retryAfter }
}
