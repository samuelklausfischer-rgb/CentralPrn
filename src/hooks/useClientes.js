import { useState, useEffect, useCallback } from 'react'
import { omieClients, delay } from '../api/omie.js'
import { hojeBR } from '../utils/dates.js'

const CACHE_TTL = 5 * 60_000

export function useClientes(empresa, { enabled = true } = {}) {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [retryAfter, setRetryAfter] = useState(null)
  const [retryKey, setRetryKey] = useState(0)

  // Countdown do retry automático (igual padrão do projeto)
  useEffect(() => {
    if (retryAfter === null || retryAfter <= 0) return
    const t = setTimeout(() => setRetryAfter((ra) => ra - 1), 1000)
    return () => clearTimeout(t)
  }, [retryAfter])

  useEffect(() => {
    if (retryAfter === 0) {
      setRetryAfter(null)
      setRetryKey((k) => k + 1)
    }
  }, [retryAfter])

  const retry = useCallback(() => {
    sessionStorage.removeItem(`omie_clientes_enrich_${empresa}`)
    sessionStorage.removeItem(`omie_clientes_full_${empresa}`)
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
        const CACHE_KEY = `omie_clientes_enrich_${empresa}`
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          const { ts, data } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL) {
            if (!cancelled) { setClientes(data); setLoading(false) }
            return
          }
        }

        const client = omieClients[empresa]

        // Fase 1 — paralelo (cadastro + contratos)
        const [rawClientes, rawContratos] = await Promise.all([
          client.fetchClientesFull(),
          client.fetchAllContratos(),
        ])

        await delay(400)

        // Fase 2 — títulos a receber (serializado após fase 1, anti-425)
        const rawTitulos = await client.fetchListaEmAberto(hojeBR(), 'R')

        // Agrupar contratos ATIVOS por cliente
        const contractsByClient = new Map()
        for (const ctr of rawContratos) {
          const cab = ctr.cabecalho ?? {}
          if (cab.cCodSit !== '90') continue
          const id = cab.nCodCli
          if (!id) continue
          const prev = contractsByClient.get(id) ?? { count: 0, mrr: 0 }
          contractsByClient.set(id, {
            count: prev.count + 1,
            mrr:   prev.mrr + Number(cab.nValTotMes ?? 0),
          })
        }

        // Agrupar títulos a receber por cliente
        const titulosByClient = new Map()
        for (const t of rawTitulos) {
          const id = t.nCodCliente
          if (!id) continue
          const diasAtraso = Number(t.nDiasAtraso ?? 0)
          const valor      = Number(t.vDoc ?? 0)
          const prev = titulosByClient.get(id) ?? { total: 0, emAtraso: 0, maxDiasAtraso: 0 }
          titulosByClient.set(id, {
            total:          prev.total + valor,
            emAtraso:       prev.emAtraso + (diasAtraso > 0 ? valor : 0),
            maxDiasAtraso:  Math.max(prev.maxDiasAtraso, diasAtraso),
          })
        }

        // Enriquecer cada cliente com contratos + recebíveis
        const enriched = rawClientes.map((c) => {
          const id   = c.codigo_cliente_omie
          const ctrs = contractsByClient.get(id) ?? { count: 0, mrr: 0 }
          const tits = titulosByClient.get(id)   ?? { total: 0, emAtraso: 0, maxDiasAtraso: 0 }
          return {
            id,
            nome:   c.razao_social || c.nome_fantasia || `Cliente ${id}`,
            cidade: c.cidade || '—',
            estado: c.estado || '—',
            cnpj:   c.cnpj_cpf || '',
            qtdContratos:   ctrs.count,
            mrr:            ctrs.mrr,
            temContrato:    ctrs.count > 0,
            totalAReceber:  tits.total,
            valorEmAtraso:  tits.emAtraso,
            maxDiasAtraso:  tits.maxDiasAtraso,
            temAtraso:      tits.emAtraso > 0,
          }
        })

        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: enriched }))

        if (!cancelled) setClientes(enriched)
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

  return { clientes, loading, error, retryAfter, retry }
}
