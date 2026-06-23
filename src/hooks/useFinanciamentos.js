import { useState, useEffect, useMemo, useRef } from 'react'
import { useContasPagar } from './useContasPagar.js'
import { computarView } from '../utils/financiamento.js'
import { fetchFinanciamentoDB, salvarFinanciamentos } from '../api/supabase.js'

// Estratégia pedida: ao abrir, mostra na hora o que está salvo no BANCO e, em paralelo,
// varre a OMIE para conferir se há algo novo — quando termina, atualiza a tela e regrava
// o banco. `enabled` liga a empresa; `apiEnabled` serializa a varredura (anti-425).
export function useFinanciamentos(empresa = 'prn', { enabled = true, apiEnabled = true } = {}) {
  const [db, setDb] = useState(null) // { data, atualizadoEm, view }
  const salvouRef = useRef(null)

  // 1) Banco primeiro (rápido)
  useEffect(() => {
    if (!enabled) return
    let cancel = false
    fetchFinanciamentoDB(empresa)
      .then((r) => { if (!cancel) setDb(r) })
      .catch(() => {})
    return () => { cancel = true }
  }, [empresa, enabled])

  // 2) Omie (varredura completa) — usa o hook paginado com 425/cache
  const api = useContasPagar(empresa, { enabled: enabled && apiEnabled })
  const apiView = useMemo(
    () => (api.itens && !api.loading ? computarView(api.itens) : null),
    [api.itens, api.loading]
  )

  // 3) Quando a Omie conclui, regrava o banco (uma vez por carga)
  useEffect(() => {
    if (!apiView) return
    const k = `${empresa}:${api.itens?.length}`
    if (salvouRef.current === k) return
    salvouRef.current = k
    salvarFinanciamentos(empresa, apiView)
  }, [apiView, empresa, api.itens])

  const view = apiView || db?.view || null
  const fonte = apiView ? 'omie' : (db ? 'banco' : null)
  return {
    view,
    fonte,                                   // 'omie' (fresco) | 'banco' (salvo) | null
    atualizadoEm: apiView ? Date.now() : (db?.atualizadoEm || null),
    loading: !view,                          // nada para mostrar ainda
    atualizando: api.loading && fonte === 'banco', // mostrando banco enquanto a Omie carrega
    error: api.error,
    retry: api.retry,
    retryAfter: api.retryAfter,
    progress: api.progress,
  }
}
