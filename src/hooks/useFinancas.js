import { useState, useEffect, useCallback } from 'react'
import { omieClients } from '../api/omie.js'
import { upsertSnapshotHoje } from '../api/supabase.js'

function hojeBR() {
  const d = new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function parseRetryAfter(message) {
  const m = String(message).match(/(\d+)\s*segundos/i)
  return m ? parseInt(m[1], 10) : null
}

const CACHE_TTL = 5 * 60_000

function cacheKey(empresa) { return `omie_resumo_financas_${empresa}` }

function getCache(empresa, dDia) {
  try {
    const raw = sessionStorage.getItem(cacheKey(empresa))
    if (!raw) return null
    const { ts, dia, data } = JSON.parse(raw)
    if (dia !== dDia) return null
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch { return null }
}

function setCache(empresa, dDia, data) {
  try {
    sessionStorage.setItem(cacheKey(empresa), JSON.stringify({ ts: Date.now(), dia: dDia, data }))
  } catch {}
}

// empresa: 'prn' | 'medimagem'
// enabled: permite serializar o carregamento (default true)
export function useFinancas(empresa = 'prn', { enabled = true } = {}) {
  const [resumo, setResumo]         = useState(null)
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
    sessionStorage.removeItem(cacheKey(empresa))
    setError(null); setRetryAfter(null); setLoading(true); setRetryKey((k) => k + 1)
  }, [empresa])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const dDia = hojeBR()
    const client = omieClients[empresa]

    async function load() {
      try {
        const cached = getCache(empresa, dDia)
        const data = cached ?? (await client.fetchResumoFinancas(dDia))
        if (cancelled) return
        if (!cached) setCache(empresa, dDia, data)
        setResumo({ ...data, dDia })
        // Grava snapshot de hoje no Supabase (fire-and-forget)
        upsertSnapshotHoje(data, empresa).catch(() => {})
      } catch (err) {
        if (cancelled) return
        const seconds = parseRetryAfter(err.message)
        setError(err.message)
        if (seconds) setRetryAfter(seconds)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [retryKey, enabled, empresa])

  return { resumo, loading, error, retry, retryAfter }
}
