import { useState, useEffect, useCallback } from 'react'
import { omieClients } from '../api/omie.js'
import { hojeBR } from '../utils/dates.js'

const CACHE_TTL = 5 * 60_000

export function useFornecedores(empresa, { enabled = true } = {}) {
  const [fornecedores, setFornecedores] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState(null)
  const [retryAfter, setRetryAfter]     = useState(null)
  const [retryKey, setRetryKey]         = useState(0)

  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return
    const t = setTimeout(() => setRetryAfter((ra) => ra - 1), 1000)
    return () => clearTimeout(t)
  }, [retryAfter])

  useEffect(() => {
    if (retryAfter === 0) { setRetryAfter(null); setRetryKey((k) => k + 1) }
  }, [retryAfter])

  const retry = useCallback(() => {
    sessionStorage.removeItem(`omie_fornecedores_${empresa}`)
    setError(null)
    setRetryAfter(null)
    setRetryKey((k) => k + 1)
  }, [empresa])

  useEffect(() => {
    if (!enabled) { setLoading(false); return }

    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const CACHE_KEY = `omie_fornecedores_${empresa}`
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          const { ts, data } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL) {
            if (!cancelled) { setFornecedores(data); setLoading(false) }
            return
          }
        }

        const client = omieClients[empresa]
        const rawTitulos = await client.fetchListaEmAberto(hojeBR(), 'P')

        // Agrupa títulos A Pagar por fornecedor (cNomeCliente)
        const map = new Map()
        for (const t of rawTitulos) {
          const nome      = t.cNomeCliente || '—'
          const valor     = Number(t.vDoc ?? 0)
          const diasAtraso = Number(t.nDiasAtraso ?? 0)
          const categoria = t.cDescCateg || 'Sem categoria'

          const prev = map.get(nome) ?? {
            nome,
            totalAPagar:    0,
            emAtraso:       0,
            maxDiasAtraso:  0,
            catValores:     {},   // categoria → valor acumulado
          }

          prev.catValores[categoria] = (prev.catValores[categoria] ?? 0) + valor

          map.set(nome, {
            ...prev,
            totalAPagar:   prev.totalAPagar + valor,
            emAtraso:      prev.emAtraso + (diasAtraso > 0 ? valor : 0),
            maxDiasAtraso: Math.max(prev.maxDiasAtraso, diasAtraso),
            catValores:    prev.catValores,
          })
        }

        // Converte para array resolvendo categoria de maior valor
        const enriched = [...map.values()].map((f) => {
          let categoriaPrincipal = 'Sem categoria'
          let maxCatVal = 0
          for (const [cat, val] of Object.entries(f.catValores)) {
            if (val > maxCatVal) { maxCatVal = val; categoriaPrincipal = cat }
          }
          return {
            nome:           f.nome,
            totalAPagar:    f.totalAPagar,
            emAtraso:       f.emAtraso,
            maxDiasAtraso:  f.maxDiasAtraso,
            temAtraso:      f.emAtraso > 0,
            categoria:      categoriaPrincipal,
          }
        })

        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: enriched }))
        if (!cancelled) setFornecedores(enriched)
      } catch (err) {
        if (cancelled) return
        const msg = err.message ?? String(err)
        const m   = msg.match(/(\d+)\s*segundo/i)
        if (m) {
          setRetryAfter(Number(m[1]))
          setError(`Omie throttle — aguardando ${m[1]}s`)
        } else {
          setError(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [empresa, enabled, retryKey])

  return { fornecedores, loading, error, retryAfter, retry }
}
