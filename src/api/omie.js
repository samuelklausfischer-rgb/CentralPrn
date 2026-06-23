const BASE_URL = '/omie-api'

export function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// Factory: cria um cliente Omie vinculado a um par de credenciais específico.
// Cada empresa tem sua própria instância (omieClients.prn / omieClients.medimagem).
export function makeOmieClient(appKey, appSecret, empresaKey) {
  async function omieCall(endpoint, call, param) {
    const res = await fetch(`${BASE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call, app_key: appKey, app_secret: appSecret, param }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(data?.faultstring ?? `Omie API error: ${res.status}`)
    }
    if (data?.status === 'error') throw new Error(data.message)
    return data
  }

  async function fetchAllContratos() {
    const data = await omieCall('servicos/contrato/', 'ListarContratos', [
      { pagina: 1, registros_por_pagina: 500 },
    ])
    return data.contratoCadastro ?? []
  }

  async function fetchListaEmAberto(dDia, cTipo, nRegPorPagina = 500) {
    const data = await omieCall('financas/resumo/', 'ObterListaEmAberto', [
      { dDia, cTipo, nRegPorPagina, nPagina: 1 },
    ])
    return data.ListaEmEberto ?? []
  }

  async function fetchResumoFinancas(dDia) {
    return omieCall('financas/resumo/', 'ObterResumoFinancas', [
      { dDia, lExibirCategoria: 'S' },
    ])
  }

  async function fetchResumoServicos(dDataInicio, dDataFim) {
    return omieCall('servicos/resumo/', 'ObterResumoServicos', [
      { dDataInicio, dDataFim, lApenasResumo: true },
    ])
  }

  async function fetchListarOrcamentos(nAno, nMes) {
    return omieCall('financas/caixa/', 'ListarOrcamentos', [
      { nAno, nMes },
    ])
  }

  async function fetchResumoOportunidades(cMesAno) {
    return omieCall('crm/oportunidades-resumo/', 'ObterResumoOp', [
      { cMesAno, lApenasResumo: true },
    ])
  }

  // Uma página de Contas a Pagar (ListarContasPagar é paginado: Omie limita a ~100/página).
  // Resposta: { conta_pagar_cadastro[], total_de_paginas, total_de_registros, pagina }
  async function fetchContasPagarPagina(pagina = 1, registros_por_pagina = 500) {
    const data = await omieCall('financas/contapagar/', 'ListarContasPagar', [
      { pagina, registros_por_pagina },
    ])
    return {
      itens: data.conta_pagar_cadastro ?? [],
      totalPaginas: data.total_de_paginas ?? 1,
      totalRegistros: data.total_de_registros ?? 0,
      pagina: data.pagina ?? pagina,
    }
  }

  // Mapa código_categoria → descrição (namespaceado por empresa). Best-effort:
  // categorias legadas/ocultas (ex.: 2.04.x) podem não vir; nesses casos cai no código.
  const CATEG_CACHE_KEY = `omie_categorias_map_${empresaKey}`

  async function fetchCategoriasMap() {
    const cached = sessionStorage.getItem(CATEG_CACHE_KEY)
    if (cached) return new Map(JSON.parse(cached))

    const map = new Map()
    const data = await omieCall('geral/categorias/', 'ListarCategorias', [
      { pagina: 1, registros_por_pagina: 500 },
    ])
    for (const c of data.categoria_cadastro ?? []) {
      const cod = c.codigo || c.codigo_dre
      if (cod) map.set(cod, c.descricao || c.descricao_padrao || cod)
    }
    sessionStorage.setItem(CATEG_CACHE_KEY, JSON.stringify([...map]))
    return map
  }

  async function fetchAllOS() {
    const allOS = []
    let pagina = 1
    const registros_por_pagina = 50
    while (true) {
      const data = await omieCall('servicos/os/', 'ListarOS', [{ pagina, registros_por_pagina }])
      // Omie pode retornar faultstring com HTTP 200 quando não há registros
      if (data?.faultstring) break
      const items = data.ordemServicoCadastro ?? []
      allOS.push(...items)
      if (pagina >= (data.nTotPaginas ?? 1) || items.length === 0 || allOS.length >= 500) break
      pagina++
    }
    return allOS
  }

  // Cache de clientes namespaceado por empresa para não misturar codigos
  const CLIENTES_CACHE_KEY      = `omie_clientes_map_${empresaKey}`
  const CLIENTES_FULL_CACHE_KEY = `omie_clientes_full_${empresaKey}`

  async function fetchClientesMap() {
    const cached = sessionStorage.getItem(CLIENTES_CACHE_KEY)
    if (cached) return new Map(JSON.parse(cached))

    const map = new Map()
    let pagina = 1
    const registros_por_pagina = 500

    while (true) {
      const data = await omieCall('geral/clientes/', 'ListarClientes', [
        { pagina, registros_por_pagina },
      ])
      for (const c of data.clientes_cadastro ?? []) {
        map.set(c.codigo_cliente_omie, c.razao_social || c.nome_fantasia || String(c.codigo_cliente_omie))
      }
      if (pagina >= data.total_de_paginas) break
      pagina++
    }

    sessionStorage.setItem(CLIENTES_CACHE_KEY, JSON.stringify([...map]))
    return map
  }

  // Retorna array completo de clientes (com cidade, estado, cnpj) — para a tela de Clientes
  async function fetchClientesFull() {
    const cached = sessionStorage.getItem(CLIENTES_FULL_CACHE_KEY)
    if (cached) return JSON.parse(cached)

    const all = []
    let pagina = 1
    const registros_por_pagina = 500

    while (true) {
      const data = await omieCall('geral/clientes/', 'ListarClientes', [
        { pagina, registros_por_pagina },
      ])
      for (const c of data.clientes_cadastro ?? []) {
        all.push({
          codigo_cliente_omie: c.codigo_cliente_omie,
          razao_social:  c.razao_social  || '',
          nome_fantasia: c.nome_fantasia || '',
          cnpj_cpf:      c.cnpj_cpf      || '',
          cidade:        c.cidade         || '',
          estado:        c.estado         || '',
        })
      }
      if (pagina >= (data.total_de_paginas ?? 1)) break
      pagina++
    }

    sessionStorage.setItem(CLIENTES_FULL_CACHE_KEY, JSON.stringify(all))
    return all
  }

  return { fetchAllContratos, fetchListaEmAberto, fetchResumoFinancas, fetchClientesMap, fetchClientesFull, fetchResumoServicos, fetchListarOrcamentos, fetchResumoOportunidades, fetchAllOS, fetchContasPagarPagina, fetchCategoriasMap }
}

export const omieClients = {
  prn: makeOmieClient(
    import.meta.env.VITE_APP_KEY_OMIE,
    import.meta.env.VITE_APP_SECRET_OMIE,
    'prn'
  ),
  medimagem: makeOmieClient(
    import.meta.env.VITE_APP_KEY_OMIE_MEDIMAGEM,
    import.meta.env.VITE_APP_SECRET_OMIE_MEDIMAGEM,
    'medimagem'
  ),
}
