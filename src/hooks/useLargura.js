import { useCallback, useRef, useState } from 'react'

// Mede a largura de um elemento via callback ref (remede sempre que o nó monta —
// inclusive quando aparece depois de um early-return). Fallback `padrao` quando 0.
export function useLargura(padrao = 600) {
  const [largura, setLargura] = useState(padrao)
  const obsRef = useRef(null)

  const ref = useCallback((node) => {
    if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null }
    if (!node) return
    const medir = () => { const w = node.offsetWidth || 0; if (w > 0) setLargura(w) }
    medir()
    requestAnimationFrame(() => requestAnimationFrame(medir))
    const ro = new ResizeObserver(medir)
    ro.observe(node)
    obsRef.current = ro
  }, [])

  return [ref, largura]
}
