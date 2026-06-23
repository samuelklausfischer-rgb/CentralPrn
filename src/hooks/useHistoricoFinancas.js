import { useState, useEffect, useCallback } from 'react'
import { fetchTodosSnapshots } from '../api/supabase.js'

// empresa: 'prn' | 'medimagem'
export function useHistoricoFinancas(empresa = 'prn') {
  const [historico, setHistorico] = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [tick, setTick]           = useState(0)

  // Permite re-buscar (ex.: após o backfill gravar novas linhas) sem recarregar a página.
  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await fetchTodosSnapshots(empresa)
        if (!cancelled) setHistorico(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [empresa, tick])

  return { historico, loading, error, refetch }
}
