// Medidor radial (semicírculo) em SVG puro — trilho com zonas coloridas + ponto no valor.
// Sem Recharts (são pequenos e numerosos; precisamos de faixas coloridas no trilho).

function pointAt(f) {
  const a = f * Math.PI // f: 0 (esquerda) → 1 (direita), sobre o topo
  return { x: 100 - 80 * Math.cos(a), y: 100 - 80 * Math.sin(a) }
}

function corDaZona(valor, zonas) {
  for (const z of zonas) if (valor <= z.ate) return z.cor
  return zonas[zonas.length - 1].cor
}

export default function GaugeRadial({ valor, min = 0, max = 100, zonas, formatar = (v) => String(v), rotulo, unidadeSub, frase, Icone, valorTexto, corForcada }) {
  const indisponivel = valor == null && valorTexto == null
  const span = (max - min) || 1
  const fracDe = (v) => Math.max(0, Math.min(1, (v - min) / span))

  // segmentos de zona (trilho)
  const segs = []
  let prev = min
  for (const z of zonas) {
    const end = Math.min(z.ate === Infinity ? max : z.ate, max)
    if (end > prev) { segs.push({ f0: fracDe(prev), f1: fracDe(end), cor: z.cor }); prev = end }
    if (prev >= max) break
  }
  if (prev < max) segs.push({ f0: fracDe(prev), f1: 1, cor: zonas[zonas.length - 1].cor })

  const fv = valor != null ? fracDe(valor) : null
  const cor = corForcada || (valor != null ? corDaZona(valor, zonas) : '#9CA3AF')
  const texto = valorTexto != null ? valorTexto : (valor != null ? formatar(valor) : '—')
  const dot = fv != null ? pointAt(fv) : null

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
        {Icone && <Icone className="h-4 w-4 shrink-0 text-gray-400" />}{rotulo}
      </p>
      <div className="mt-1 flex items-end gap-3">
        <svg viewBox="0 0 200 116" className="h-[64px] w-[112px] shrink-0" aria-hidden="true">
          {indisponivel ? (
            <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#F1EFE8" strokeWidth="14" strokeLinecap="round" />
          ) : (
            <>
              {segs.map((s, i) => {
                const p0 = pointAt(s.f0), p1 = pointAt(s.f1)
                return <path key={i} d={`M ${p0.x} ${p0.y} A 80 80 0 0 1 ${p1.x} ${p1.y}`} fill="none" stroke={s.cor} strokeWidth="14" opacity="0.35" />
              })}
              {dot && <circle cx={dot.x} cy={dot.y} r="8" fill="#fff" stroke={cor} strokeWidth="4" />}
            </>
          )}
        </svg>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none" style={{ color: indisponivel ? '#9CA3AF' : cor }}>{texto}</p>
          {unidadeSub && <p className="mt-1 text-[11px] text-gray-400">{unidadeSub}</p>}
        </div>
      </div>
      {frase && <p className="mt-2 text-[11px] text-gray-500">{frase}</p>}
    </div>
  )
}
