import { useState, useEffect, useCallback } from 'react'
import { omieClients } from '../api/omie.js'

function parseOmieDate(str) {
  if (!str || str === '—') return null
  const [dd, mm, yyyy] = str.split('/')
  if (!dd || !mm || !yyyy) return null
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
}

function calcDiasRestantes(dVigFinal) {
  const fim = parseOmieDate(dVigFinal)
  if (!fim) return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.round((fim - hoje) / (1000 * 60 * 60 * 24))
}

function parseRetryAfter(message) {
  const m = String(message).match(/(\d+)\s*segundos/i)
  return m ? parseInt(m[1], 10) : null
}

const CACHE_TTL = 5 * 60_000

function cacheKey(empresa) { return `omie_contratos_cache_${empresa}` }

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
// enabled: permite serializar o carregamento (default true)
export function useContratos(empresa = 'prn', { enabled = true } = {}) {
  const [contratos, setContratos]   = useState([])
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
    const client = omieClients[empresa]

    async function load() {
      try {
        const cached = getCached(empresa)
        const [rawContratos, clientesMap] = cached
          ? [cached, await client.fetchClientesMap()]
          : await Promise.all([client.fetchAllContratos(), client.fetchClientesMap()])
        if (!cached) setCached(empresa, rawContratos)

        if (cancelled) return

        const enriched = rawContratos.map((c) => {
          const cab   = c.cabecalho ?? {}
          const code        = String(cab.cCodSit)
          const calculaDias = code === '10' || code === '90'  // ativos e vencidos mostram vencimento
          const dias        = calculaDias ? calcDiasRestantes(cab.dVigFinal) : null
          return {
            nCodCtr:       cab.nCodCtr,
            cNumCtr:       cab.cNumCtr    || '—',
            nCodCli:       cab.nCodCli,
            nomeCliente:   clientesMap.get(cab.nCodCli) ?? `Cliente ${cab.nCodCli}`,
            nValTotMes:    cab.nValTotMes ?? 0,
            dVigInicial:   cab.dVigInicial || '—',
            dVigFinal:     cab.dVigFinal   || '—',
            cCodSit:       cab.cCodSit     || '—',
            cTipoFat:      cab.cTipoFat    || '—',
            diasRestantes: dias,
          }
        })

        setContratos(enriched)
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

  return { contratos, loading, error, retry, retryAfter }
}
