import { useState, useEffect, useCallback } from 'react'
import { omieClients } from '../api/omie.js'

function parseOmieDate(str) {
  if (!str || str === '—') return null
  const [dd, mm, yyyy] = str.split('/')
  if (!dd || !mm || !yyyy) return null
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
}

function parseRetryAfter(message) {
  const m = String(message).match(/(\d+)\s*segundos/i)
  return m ? parseInt(m[1], 10) : null
}

const CACHE_TTL = 5 * 60_000
const STATUS_FINAL = ['FEF', 'CAC']

function cacheKey(empresa) { return `omie_os_cache_${empresa}` }

function getCached(empresa) {
  try {
    const raw = sessionStorage.getItem(cacheKey(empresa))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch { return null }
}

function setCached(empresa, data) {
  try {
    sessionStorage.setItem(cacheKey(empresa), JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

// empresa: 'prn' | 'medimagem'
// periodo: 'hoje' | '7d' | '1m' | '3m' | '6m' | '1a'  (default: '1m')
export function useOrdensServico(empresa = 'prn', { enabled = true, periodo = '1m' } = {}) {
  const [os, setOS]             = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [retryAfter, setRetryAfter] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

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
    const client = omieClients[empresa]

    async function load() {
      try {
        const cached = getCached(empresa)
        const [rawOS, clientesMap] = cached
          ? [cached, await client.fetchClientesMap()]
          : await Promise.all([client.fetchAllOS(), client.fetchClientesMap()])
        if (!cached) setCached(empresa, rawOS)

        if (cancelled) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const enriched = rawOS.map((item) => {
          const cab  = item.cabecalho             ?? {}
          const info = item.informacoesAdicionais ?? {}
          const status   = String(cab.cCodStatus ?? cab.cStatus ?? '')
          const dPrev    = parseOmieDate(cab.dPrevisao ?? '')
          const atrasada = dPrev !== null && !STATUS_FINAL.includes(status) && dPrev < today

          return {
            nCodOS:       cab.nCodOS,
            cNumOS:       cab.cNumOS          || '—',
            nCodCli:      cab.nCodCli,
            nomeCliente:  clientesMap.get(cab.nCodCli) ?? info.cNomeCliente ?? `Cliente ${cab.nCodCli}`,
            cStatus:      status,
            dDataOS:      cab.dDataOS         || '—',
            dPrevisao:    cab.dPrevisao        || '—',
            nValorTotal:  Number(cab.nValorTotal ?? 0),
            cDescricao:   cab.cDescricao       || '—',
            nCodContrato: cab.nCodContrato     ?? info.nCodContrato ?? null,
            cNumContrato: cab.cNumContrato     || info.cNumContrato || '—',
            cResponsavel: info.cResponsavel    || cab.cResponsavel  || '—',
            atrasada:     Boolean(atrasada),
          }
        })

        setOS(enriched)
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

  return { os, loading, error, retry, retryAfter }
}
