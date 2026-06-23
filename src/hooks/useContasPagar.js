import { useState, useEffect, useCallback, useRef } from 'react'
import { omieClients, delay } from '../api/omie.js'

function parseRetryAfter(message) {
  const m = String(message).match(/(\d+)\s*segundos/i)
  return m ? parseInt(m[1], 10) : null
}

const TTL = 30 * 60_000 // 30 min — dado pesado (varre todas as páginas)
const PASSO_DELAY = 400  // ms entre páginas (equilíbrio velocidade × rate-limit 425)
const key = (empresa) => `omie_contaspagar_aberto_${empresa}`
const PAGOS = new Set(['PAGO', 'LIQUIDADO', 'BAIXADO', 'CANCELADO'])

function getCache(empresa) {
  try {
    const raw = sessionStorage.getItem(key(empresa))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > TTL) return null
    return data
  } catch { return null }
}

function setCache(empresa, data) {
  try {
    sessionStorage.setItem(key(empresa), JSON.stringify({ ts: Date.now(), data }))
  } catch {} // se estourar a quota, segue sem cache
}

// Mapeia o título cru da Omie para a forma enxuta usada na página.
function enriquecer(t, empresa, clientesMap, categoriasMap) {
  const catCod = t.codigo_categoria || t.categorias?.[0]?.codigo_categoria || ''
  return {
    id: t.codigo_lancamento_omie,
    empresa,
    fornecedorCod: t.codigo_cliente_fornecedor,
    fornecedor: clientesMap.get(t.codigo_cliente_fornecedor) || `Fornecedor ${t.codigo_cliente_fornecedor}`,
    categoriaCod: catCod,
    categoria: categoriasMap.get(catCod) || catCod || '—',
    numeroParcela: t.numero_parcela || '',
    valor: Number(t.valor_documento) || 0,
    venc: t.data_vencimento || '',
    status: t.status_titulo || '',
    documento: t.numero_documento || '',
  }
}

// empresa: 'prn' | 'medimagem'
// Varre todas as páginas de ListarContasPagar (Omie limita a ~100/página) e mantém só os
// títulos EM ABERTO (não pagos), enriquecidos com nome de fornecedor/categoria.
// - Renderização PROGRESSIVA: publica os títulos conforme as páginas chegam.
// - Resiliente ao 425: retoma da última página concluída (não reinicia do zero).
// - Cache de 30 min em sessionStorage.
export function useContasPagar(empresa = 'prn', { enabled = true } = {}) {
  const [itens, setItens] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retryAfter, setRetryAfter] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const [progress, setProgress] = useState({ pagina: 0, total: 0 })

  // Estado de retomada (persiste entre re-execuções do efeito após um 425)
  const acc = useRef({ abertos: [], proxPagina: 1, totalPaginas: 1, clientesMap: null, categoriasMap: null })

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
    const client = omieClients[empresa]

    async function load() {
      try {
        // Cache pronto?
        const cached = getCache(empresa)
        if (cached) {
          if (!cancelled) { setItens(cached); setProgress({ pagina: 1, total: 1 }); setLoading(false) }
          return
        }

        // Mapas de apoio (cacheados internamente por empresa) — só na primeira vez
        if (!acc.current.clientesMap) {
          acc.current.clientesMap = await client.fetchClientesMap()
          if (cancelled) return
          try { acc.current.categoriasMap = await client.fetchCategoriasMap() } catch { acc.current.categoriasMap = new Map() }
          if (cancelled) return
          await delay(PASSO_DELAY)
        }
        const { clientesMap, categoriasMap } = acc.current

        // Retoma da última página concluída (proxPagina)
        while (acc.current.proxPagina <= acc.current.totalPaginas) {
          if (cancelled) return
          const pg = acc.current.proxPagina
          const r = await client.fetchContasPagarPagina(pg, 500)
          acc.current.totalPaginas = r.totalPaginas || 1
          if (!cancelled) setProgress({ pagina: pg, total: acc.current.totalPaginas })
          for (const t of r.itens) {
            if (PAGOS.has(String(t.status_titulo || '').toUpperCase())) continue
            acc.current.abertos.push(enriquecer(t, empresa, clientesMap, categoriasMap))
          }
          acc.current.proxPagina = pg + 1
          // Publicação progressiva a cada 10 páginas (e o usuário já vê dados parciais)
          if (!cancelled && (pg % 10 === 0)) setItens([...acc.current.abertos])
          if (acc.current.proxPagina <= acc.current.totalPaginas) await delay(PASSO_DELAY)
        }

        if (!cancelled) {
          setCache(empresa, acc.current.abertos)
          setItens([...acc.current.abertos])
        }
      } catch (err) {
        if (cancelled) return
        const sec = parseRetryAfter(err.message)
        setError(err.message)
        // Publica o parcial já coletado para não perder o progresso visual
        if (acc.current.abertos.length) setItens([...acc.current.abertos])
        if (sec) setRetryAfter(sec)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [retryKey, enabled, empresa])

  return { itens, loading, error, retry, retryAfter, progress }
}
