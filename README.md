# Dashboard PRN — Omie

Dashboard interno da PRN integrado à API Omie (multi-empresa: PRN, MedImagem e Consolidado).
React 18 + Vite + Tailwind + Recharts, com histórico persistido no Supabase.

## Telas
- **Contratos** (Serviços / NFS-e) com controle de vencimentos
- **Financeiro** (cockpit + visão simples: DRE, MRR/ARR, Burn, PMR, faturamento NFS-e)
- **Financiamentos & Compromissos** (parcelas em aberto agrupadas)
- **Clientes** e **Ordens de Serviço**

---

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # preencha com as credenciais reais (NÃO commitar)
npm run dev                  # http://localhost:5173
```

Em dev, o Vite faz o proxy de `/omie-api` → `https://app.omie.com.br/api/v1` (ver `vite.config.js`),
contornando o CORS do browser.

### Variáveis de ambiente (`.env.local`)
Todas precisam do prefixo `VITE_` (senão o browser não as enxerga):

| Variável | Descrição |
|---|---|
| `VITE_APP_KEY_OMIE` / `VITE_APP_SECRET_OMIE` | Credenciais Omie da PRN |
| `VITE_APP_KEY_OMIE_MEDIMAGEM` / `VITE_APP_SECRET_OMIE_MEDIMAGEM` | Credenciais Omie da MedImagem |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Projeto Supabase (histórico de snapshots) |

---

## Deploy no EasyPanel (via este repositório GitHub)

O app é uma SPA estática + um proxy reverso para a Omie. Tudo isso é empacotado pelo
`Dockerfile` (multi-stage: build Vite → nginx). O `nginx.conf` recria o proxy `/omie-api`
que em dev é feito pelo Vite — **sem ele, nenhuma chamada à Omie funciona em produção**.

> **Variáveis de ambiente são lidas em RUNTIME, não no build.** Na subida do container,
> `docker-entrypoint.d/40-config.sh` gera `/config.js` com os valores das variáveis de
> ambiente; o `index.html` carrega esse arquivo e popula `window.__ENV__`, lido por
> `src/env.js`. Isso evita o clássico problema de variáveis Vite "assadas" no build
> (build-arg/cache). Você só precisa definir as variáveis na aba **Environment** — sem
> rebuild para trocar valores, basta **Restart**.

### Passo a passo
1. No EasyPanel, crie um **App** e em **Source** selecione este repositório GitHub
   (`CentralPrn`, branch `main`).
2. Em **Build**, escolha **Dockerfile** (o EasyPanel detecta o `Dockerfile` na raiz).
3. Em **Environment**, defina as 6 variáveis `VITE_*` da tabela acima (nomes exatos).
4. A porta do container é **80** (já exposta no Dockerfile).
5. Configure o **domínio** e faça o **Deploy**.

> Diagnóstico: nos logs do container procure a linha `[40-config] /config.js gerado — N
> variável(is) preenchida(s) de 6`. Se `N < 6`, alguma variável não foi definida na aba
> Environment. No navegador, abra `https://SEU_DOMINIO/config.js` para ver o que chegou.

### Segurança — leia antes de expor publicamente
As variáveis `VITE_*` são embutidas no JavaScript do navegador. Isso significa que a
**`APP_SECRET` da Omie fica visível** para quem abrir a página. Por isso:

- **Restrinja o acesso** ao app (ex.: Basic Auth via middleware do EasyPanel/Traefik,
  ou mantenha em rede privada). Não deixe a URL aberta na internet.
- **Rotacione a `APP_SECRET` da Omie** periodicamente (e especialmente se a URL vazar).
- A `VITE_SUPABASE_ANON_KEY` é segura para o browser (protegida por RLS) — não é problema.

> Evolução recomendada: mover as credenciais Omie para um BFF (proxy que injeta o segredo
> no lado servidor), de modo que o navegador nunca receba a `APP_SECRET`.

---

## Stack
- **Frontend:** React 18, Vite 6, Tailwind 3, Recharts 3
- **Dados:** API Omie (`/api/v1`) via proxy, Supabase (`@supabase/supabase-js`)
- **Deploy:** Docker (node:22 build → nginx:alpine)
