import { useState, useEffect, useCallback } from 'react'
import { omieClients } from '../api/omie.js'
import { parseDRE } from '../utils/financeiro.js'

function parseRetryAfter(message) {
  const m = String(message).match(/(\d+)\s*segundos/i)
  return m ? parseInt(m[1], 10) : null
}

const TTL = 5 * 60_000
const key = (empresa, ano, mes) => `omie_dre_${empresa}_${ano}_${mes}`

function getCache(empresa, ano, mes) {
  try {
    const raw = sessionStorage.getItem(key(empresa, ano, mes))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > TTL) return null
    return data
  } catch { return null }
}

function setCache(empresa, ano, mes, data) {
  try {
    sessionStorage.setItem(key(empresa, ano, mes), JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

export function useDRE(empresa = 'prn', { enabled = true, nAno, nMes } = {}) {
  const [dre, setDre]           = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [retryAfter, setRetryAfter] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

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
    if (!enabled || !nAno || !nMes) return
    let cancelled = false
    const client = omieClients[empresa]

    async function load() {
      try {
        let raw = getCache(empresa, nAno, nMes)
        if (!raw) {
          raw = await client.fetchListarOrcamentos(nAno, nMes)
          if (!cancelled) setCache(empresa, nAno, nMes, raw)
        }
        if (!cancelled) setDre(parseDRE(raw.ListaOrcamentos || []))
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
  }, [retryKey, enabled, empresa, nAno, nMes])

  return { dre, loading, error, retry, retryAfter }
}
