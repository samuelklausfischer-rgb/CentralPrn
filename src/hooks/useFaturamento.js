import { useState, useEffect, useCallback } from 'react'
import { omieClients } from '../api/omie.js'

function parseRetryAfter(message) {
  const m = String(message).match(/(\d+)\s*segundos/i)
  return m ? parseInt(m[1], 10) : null
}

const TTL = 5 * 60_000
const key = (empresa, ini, fim) => `omie_faturamento_${empresa}_${ini}_${fim}`

function getCache(empresa, ini, fim) {
  try {
    const raw = sessionStorage.getItem(key(empresa, ini, fim))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > TTL) return null
    return data
  } catch { return null }
}

function setCache(empresa, ini, fim, data) {
  try {
    sessionStorage.setItem(key(empresa, ini, fim), JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

// empresa: 'prn' | 'medimagem'
// dataInicio / dataFim: DD/MM/AAAA (formato Omie)
export function useFaturamento(empresa = 'prn', { enabled = true, dataInicio = '', dataFim = '' } = {}) {
  const [faturamento, setFaturamento] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [retryAfter, setRetryAfter]   = useState(null)
  const [retryKey, setRetryKey]       = useState(0)

  useEffect(() => {
    if (!retryAfter) return
    if (retryAfter <= 0) {
      setRetryAfter(null); setError(null); setLoading(true); setRetryKey((k) => k + 1); return
    }
    const id = setTimeout(() => setRetryAfter((s) => (s !== null ? s - 1 : null)), 1000)
    return () => clearTimeout(id)
  }, [retryAfter])

  const retry = useCallback(() => {
    setError(null); setRetryAfter(null); setLoading(true); setRetryKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!enabled || !dataInicio || !dataFim) return
    let cancelled = false
    const client = omieClients[empresa]

    async function load() {
      try {
        let data = getCache(empresa, dataInicio, dataFim)
        if (!data) {
          data = await client.fetchResumoServicos(dataInicio, dataFim)
          if (!cancelled) setCache(empresa, dataInicio, dataFim, data)
        }
        if (!cancelled) setFaturamento(data)
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
  }, [retryKey, enabled, empresa, dataInicio, dataFim])

  return { faturamento, loading, error, retry, retryAfter }
}
