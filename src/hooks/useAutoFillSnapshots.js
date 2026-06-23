import { useEffect, useRef } from 'react'
import { omieClients, delay } from '../api/omie.js'
import { upsertSnapshotData } from '../api/supabase.js'
import { isoNDiasAtras, isoParaBR, ultimasNFimDeMes } from '../utils/dates.js'

// Empresa "nova" = poucas linhas → modo full backfill
const FRESH_THRESHOLD    = 30
// Modo normal: verifica os últimos 30 dias, max 5 por lote
const JANELA_NORMAL      = 30
const MAX_NORMAL         = 5
// Modo full (empresa nova): 60 dias diários + 12 fins de mês, max 20 por lote
const JANELA_FULL        = 60
const MESES_FULL         = 12
const MAX_FULL           = 20

// Empresa precisa de full backfill se tem poucas linhas OU se falta algum fim de mês histórico
function precisaFullBackfill(datasExistentes) {
  if (datasExistentes.length < FRESH_THRESHOLD) return true
  const existentes = new Set(datasExistentes)
  return ultimasNFimDeMes(MESES_FULL).some((iso) => !existentes.has(iso))
}

function gerarFaltantes(datasExistentes, full) {
  const existentes = new Set(datasExistentes)
  const candidatos = new Set()

  const dias = full ? JANELA_FULL : JANELA_NORMAL
  for (let i = 1; i <= dias; i++) {
    candidatos.add(isoNDiasAtras(i))
  }

  if (full) {
    for (const iso of ultimasNFimDeMes(MESES_FULL)) {
      candidatos.add(iso)
    }
  }

  // Mais recente primeiro: o usuário vê os dados relevantes antes
  return [...candidatos]
    .filter((iso) => !existentes.has(iso))
    .sort((a, b) => b.localeCompare(a))
}

// Self-heal: detecta dias faltantes e busca/grava no Supabase (serial, com gap ~1,5s).
// Processa lote após lote no mesmo carregamento (sem reloads manuais), pulando erros
// transitórios da Omie e parando apenas em rate-limit (425) — que retoma no próximo
// carregamento da página. onConcluir (refetch do histórico) faz as linhas gravadas
// aparecerem na timeline sem recarregar.
export function useAutoFillSnapshots(enabled, datasExistentes, empresa = 'prn', onConcluir) {
  const rodando   = useRef(false)  // guarda de concorrência (1 pass por vez)
  const concluido = useRef(false)  // já fez o pass deste mount → não repete

  useEffect(() => {
    if (!enabled || rodando.current || concluido.current) return

    const client = omieClients[empresa]
    const existentes = new Set(datasExistentes || [])
    rodando.current = true
    let cancelled = false

    ;(async () => {
      let gravouAlgo = false
      let throttled = false
      let falhasOmie = 0   // datas sem dados na Omie (ex.: "Broken response") — puladas
      let falhasGrava = 0  // falhas de persistência no Supabase — registradas p/ visibilidade

      while (!cancelled) {
        const full = precisaFullBackfill([...existentes])
        const faltantes = gerarFaltantes([...existentes], full)
        if (faltantes.length === 0) break

        const alvo = faltantes.slice(0, full ? MAX_FULL : MAX_NORMAL)
        let progrediu = false

        for (const iso of alvo) {
          if (cancelled) break

          let resumo
          try {
            resumo = await client.fetchResumoFinancas(isoParaBR(iso))
          } catch (err) {
            const msg = String(err?.message ?? err)
            if (/425|segundos/i.test(msg)) { throttled = true; break } // rate-limit → para
            falhasOmie++                 // transitório → pula esta data
            existentes.add(iso); progrediu = true
            await delay(1500)
            continue
          }

          try {
            await upsertSnapshotData(iso, resumo, empresa)
            gravouAlgo = true
          } catch {
            falhasGrava++                // erro de gravação ≠ erro da Omie: registra, não para
          }

          existentes.add(iso); progrediu = true
          await delay(1500)
        }

        if (throttled || !progrediu) break
      }

      rodando.current = false
      // Throttle → retoma no próximo carregamento da página. Caso contrário, encerra o pass.
      if (!throttled) concluido.current = true

      if (falhasOmie)  console.warn(`[autofill ${empresa}] ${falhasOmie} dia(s) sem dados na Omie — pulados`)
      if (falhasGrava) console.error(`[autofill ${empresa}] ${falhasGrava} falha(s) ao gravar no Supabase`)

      // Surfacing: novas linhas aparecem na timeline sem recarregar a página
      if (!cancelled && gravouAlgo && typeof onConcluir === 'function') onConcluir()
    })()

    return () => { cancelled = true; rodando.current = false }
  }, [enabled, datasExistentes, empresa, onConcluir])
}
