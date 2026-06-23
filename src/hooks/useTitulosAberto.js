import { useState, useEffect, useCallback } from 'react'
import { omieClients, delay } from '../api/omie.js'
import { hojeBR } from '../utils/dates.js'

function parseRetryAfter(message) {
  const m = String(message).match(/(\d+)\s*segundos/i)
  return m ? parseInt(m[1], 10) : null
}

const TTL = 5 * 60_000
const key = (empresa, tipo, dia) => `omie_lista_aberto_${empresa}_${tipo}_${dia}`

function getCache(empresa, tipo, dia) {
  try {
    const raw = sessionStorage.getItem(key(empresa, tipo, dia))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > TTL) return null
    return data
  } catch { return null }
}

function setCache(empresa, tipo, dia, data) {
  try {
    sessionStorage.setItem(key(empresa, tipo, dia), JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

// empresa: 'prn' | 'medimagem'
// enabled: serializa após a Fase 1 (evita 425)
export function useTitulosAberto(empresa = 'prn', { enabled = true } = {}) {
  const [receber, setReceber]       = useState(null)
  const [pagar, setPagar]           = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [retryAfter, setRetryAfter] = useState(null)
  const [retryKey, setRetryKey]     = useState(0)

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
    if (!enabled) return
    let cancelled = false
    const dia = hojeBR()
    const client = omieClients[empresa]

    async function load() {
      try {
        let r = getCache(empresa, 'R', dia)
        if (!r) {
          r = await client.fetchListaEmAberto(dia, 'R', 500)
          setCache(empresa, 'R', dia, r)
          await delay(800)
        }
        if (cancelled) return
        setReceber(r)

        let p = getCache(empresa, 'P', dia)
        if (!p) {
          p = await client.fetchListaEmAberto(dia, 'P', 500)
          setCache(empresa, 'P', dia, p)
        }
        if (cancelled) return
        setPagar(p)
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
  }, [retryKey, enabled, empresa])

  return { receber, pagar, loading, error, retry, retryAfter }
}
