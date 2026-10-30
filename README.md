# Kurio — marketplace de NFTs

Fluxos de **descoberta, compra e conta do colecionador**, em desktop, tablet e mobile. API REST,
autenticação, carteiras, pagamentos e eventos em tempo real funcionam com **dados simulados (MSW)**,
sem backend, blockchain, extensão de carteira ou gateway de pagamento reais.

| Responsabilidade | Tecnologia |
| --- | --- |
| Interface | React 19 |
| Linguagem | TypeScript (strict) |
| Roteamento | TanStack Router (rotas por código, search params tipados, rotas privadas) |
| Estado remoto | TanStack Query 5 |
| Cliente HTTP | Axios (todas as chamadas REST) |
| Integração de dados | REST (contratos zod compartilhados — [docs/API.md](docs/API.md)) |
| Tempo real | Socket.IO (`socket.io-client`) |
| Estilização | Tailwind CSS 4 |
| Componentes | shadcn/ui (Radix) adaptado à identidade visual |
| Mocking | MSW 2 (REST) + `@mswjs/socket.io-binding` (Socket.IO) |
| Testes E2E e regressão visual | Playwright |
| Auditoria de performance e qualidade | Lighthouse 13 |

**Documentação:** [ARCHITECTURE.md](ARCHITECTURE.md) (decisões, sessão, carrinho, cache, tempo real,
limitações, desvios do layout) · [docs/API.md](docs/API.md) (contratos REST e eventos) ·
[docs/GUIA-WINDOWS.md](docs/GUIA-WINDOWS.md) (passo a passo no Windows) ·
[lighthouse/README.md](lighthouse/README.md) (auditoria e análise).

## Requisitos

- **Node.js 22.19+** (ou 24 LTS) e npm 10+ — exigência do Lighthouse 13; Vite 7 também roda nessa versão.
- Para testes e auditoria: Chromium do Playwright (`npx playwright install chromium`) ou Google Chrome.

## Início rápido

```bash
npm install            # gera node_modules e o package-lock.json (lockfile da entrega)
npm run dev            # http://localhost:5173 — com mocks ativos
```

No Windows, siga o [guia passo a passo](docs/GUIA-WINDOWS.md).

## Variáveis de ambiente

Todas são públicas (embutidas no bundle pelo Vite) — não coloque segredos nelas. Os valores de
desenvolvimento estão em `.env`, os do build de demonstração em `.env.production` e o modelo em
`.env.example`.

| Variável | Padrão | Função |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa a camada MSW (REST + Socket.IO). Obrigatória para a demonstração. |
| `VITE_MOCK_DEVTOOLS` | `true` | Mostra o painel **Simulação** (cenários, reset, eventos). |
| `VITE_API_BASE_URL` | `/api` | Base da API REST. Com mocks, `/api/*` é atendido pelo MSW. |
| `VITE_SOCKET_URL` | vazio (mesma origem) | Servidor Socket.IO. Com mocks, a conexão é interceptada pelo MSW. |
| `VITE_SOCKET_PATH` | `/socket.io` | Caminho do Socket.IO. |

## Credenciais fictícias

| E-mail | Senha | Dados iniciais |
| --- | --- | --- |
| `ana@kurio.dev` | `Kurio@123` | carteiras principal (MetaMask/Ethereum) e secundária (Phantom/Solana), carrinho com 2 itens, pedido `KUR-1000` confirmado |
| `bruno@kurio.dev` | `Kurio@456` | carteira principal (Coinbase/Polygon), pedido `KUR-1001` |
| `carla@kurio.dev` | `Kurio@789` | conta sem carteiras (exercita o cadastro de carteiras) |

As senhas existem no projeto apenas como hash PBKDF2-SHA-256 com sal; o texto puro nunca é
armazenado. Cupons: `KURIO10` (10%), `LANCAMENTO` (0,05 ETH a partir de 0,5 ETH), `BOASVINDAS` (5%) e
`EXPIRADO` (expirado). Qualquer outro código é inválido.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` / `npm run dev:mocks` | Servidor de desenvolvimento com mocks (porta 5173) |
| `npm run build` | Verificação de tipos + build de produção (`dist/`) |
| `npm run build:demo` | Build de produção/demonstração (usado no deploy, testes e auditoria) |
| `npm run preview` | Serve o `dist/` em http://localhost:4173 |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm run lint` / `npm run lint:fix` | ESLint (typescript-eslint, react-hooks, react-refresh, jsx-a11y) |
| `npm run test:e2e` | Playwright — fluxos em Chromium desktop e mobile (sobe build + preview sozinho) |
| `npm run test:e2e:desktop` / `test:e2e:mobile` | Um viewport só |
| `npm run test:visual` / `test:visual:update` | Regressão visual (início, detalhe, carrinho, pagamento) / atualizar baselines |
| `npm run test:all` | Todos os projetos do Playwright |
| `npm run test:report` | Abre o relatório HTML (`reports/playwright`) com os traces das falhas |
| `npm run lighthouse` | Auditoria completa (ver abaixo); `lighthouse:mobile` / `lighthouse:desktop` |
| `npm run check` | typecheck + lint + build |
| `npm run assets:generate` / `icons:generate` | Regenera as imagens substitutas / os ícones |
| `npm run msw:init` | Recopia `public/mockServiceWorker.js` |

## Cenários de simulação

O cenário ativo é escolhido de três formas, todas reproduzíveis (semente fixa, sem aleatoriedade):

1. **URL:** `/?scenario=<nome>` aplica e guarda o cenário; `&reset=1` (ou só `/?reset=1`) restaura
   integralmente os dados simulados (catálogo, contas, carrinhos, favoritos, carteiras, pedidos).
2. **Painel Simulação** (botão "Simulação · cenário" no canto da tela): escolher cenário, **Aplicar**,
   **Aplicar e restaurar dados**, **Restaurar tudo** e ações no servidor simulado (preço, esgotamento,
   eventos duplicados/antigos, queda do Socket.IO, expiração de sessão, liquidação de pedidos,
   desconexão da carteira).
3. **Testes:** a fixture do Playwright grava a configuração antes do carregamento e expõe
   `window.__KURIO_MOCK__` (mesma API do painel).

| Cenário | Comportamento |
| --- | --- |
| `default` | Tudo funciona, latência realista e determinística (120–420 ms) |
| `empty-catalog` | A listagem de NFTs retorna zero resultados |
| `slow-network` | Todas as respostas levam ~2,5 s (skeletons) |
| `variable-latency` | Latência entre 100 ms e 2 s, sorteada com semente fixa |
| `out-of-order` | Buscas mais curtas respondem por último (o cliente descarta respostas obsoletas) |
| `offline` | Toda requisição REST falha por indisponibilidade de conexão |
| `server-error` | `GET /api/nfts` falha 3 vezes com HTTP 500 e depois volta |
| `session-short` | Novas sessões expiram em 60 s |
| `favorites-failure` | Incluir/remover favorito responde 503 (rollback otimista) |
| `price-change` | Ao enviar o pedido, o preço do 1º item sobe 12% (exige nova confirmação) |
| `sold-out` | Ao enviar o pedido, a edição do 1º item esgota |
| `order-timeout` | O pedido é criado, mas a resposta chega depois do timeout do cliente |
| `payment-declined` | Pagamentos são recusados pela carteira simulada |
| `payment-manual` | Pedidos ficam pendentes até serem confirmados/recusados no painel |
| `wallet-reject` | A primeira tentativa de conectar a carteira é recusada |
| `realtime-offline` | O servidor Socket.IO recusa conexões (o cliente tenta reconectar) |

O estado simulado fica no `localStorage` (sobrevive a refresh e é compartilhado entre abas); o reset
restaura um cenário conhecido.

## Como reproduzir os fluxos de falha

Entre como `ana@kurio.dev` / `Kurio@123` (ela já tem carteiras e itens no carrinho), salvo indicação.

| Fluxo | Como reproduzir |
| --- | --- |
| Busca com respostas fora de ordem | `/?scenario=out-of-order` → digite rápido na busca: só o último termo é exibido |
| Erro HTTP 5xx e recuperação | `/?scenario=server-error&reset=1` → o catálogo mostra erro após os retries; **Tentar novamente** recupera |
| Sem conexão | `/?scenario=offline` → mensagens de indisponibilidade; volte ao `default` pelo painel e tente de novo |
| Skeletons / carregamento lento | `/?scenario=slow-network` → catálogo, detalhe e resumo do carrinho com shimmer |
| Sessão expirada na navegação | Painel → **Expirar sessão agora** → abra Perfil: login com retorno à página |
| Sessão expirada no checkout | Em **Pagamento**, preencha os dados → painel → **Expirar sessão agora** → **Revisar pedido**: login e retorno com o rascunho preservado |
| Cadastro com conflito | **Cadastro** com o e-mail `ana@kurio.dev` → erro de e-mail em uso no campo |
| Validação de formulários | Envie Cadastro, Perfil, Senha ou Carteira com campos vazios/inválidos (ex.: endereço `0x123`) |
| Favorito com falha | `/?scenario=favorites-failure` → favoritar: o coração volta ao estado anterior e um aviso é anunciado |
| Cupom inválido / expirado | Carrinho → cupom `NAOEXISTE` ou `EXPIRADO` |
| Pagamento recusado | `/?scenario=payment-declined` → Pagamento → **Revisar pedido** → **Confirmar pagamento**: pedido recusado e itens preservados no carrinho |
| Clique repetido | No diálogo de revisão, clique várias vezes em **Confirmar pagamento**: um único pedido é criado |
| Timeout com recuperação | `/?scenario=order-timeout` → Confirmar: após o timeout, o reenvio com a mesma chave de idempotência recupera **o mesmo** pedido |
| Preço alterado durante a compra | `/?scenario=price-change` → Confirmar: o servidor rejeita a cotação, os valores novos aparecem e é preciso confirmar de novo |
| Edição esgotada durante a compra | `/?scenario=sold-out` → Confirmar: a confirmação é bloqueada e a indisponibilidade informada |
| Carteira recusa / desconecta | `/?scenario=wallet-reject` → **Conectar carteira**: recusa e nova tentativa; ou painel → **Desconectar carteira (extensão)** antes de confirmar |
| Preço/esgotamento em tempo real | Com o carrinho aberto (ou o diálogo de revisão), painel → **Subir 10% o preço do 1º item** ou **Esgotar a edição do 1º item**: aviso, resumo atualizado e confirmação bloqueada até nova cotação |
| Eventos duplicados ou antigos | Painel → **Reenviar último evento (duplicata)** / **Enviar evento antigo do 1º item**: nada regride nem é reaplicado |
| Queda do Socket.IO e retomada | `/?scenario=payment-manual` → confirme um pedido (fica pendente) → painel → **Derrubar conexões Socket.IO** → **Confirmar pedidos pendentes** → ao reconectar, o estado é reconciliado pela API REST |
| Refresh com pedido pendente | `/?scenario=payment-manual` → confirme → pressione F5: o mesmo pedido continua pendente, sem nova compra |
| Tempo real indisponível | `/?scenario=realtime-offline` → a interface funciona e indica a reconexão |
| Rota inexistente / recurso inexistente | `/qualquer-coisa` e `/nft/nao-existe` |

## Testes (Playwright)

```bash
npx playwright install chromium   # uma vez
npm run test:e2e                  # desktop-chromium + mobile-chromium
npm run test:visual               # visual-desktop + visual-mobile
npm run test:report
```

- Os testes rodam contra o **build de demonstração** (`build:demo` + `preview`, iniciados pelo
  `webServer` do Playwright) e passam pelos handlers do MSW (REST) e pelo `socket.io-client`
  (tempo real) — nada é simulado diretamente na interface.
- Cada teste parte de um estado isolado: contexto novo do navegador, cenário gravado antes do
  carregamento e dados restaurados. Latência e liquidação são controladas pela configuração dos mocks;
  a expiração natural de sessão usa o relógio controlado do Playwright (`page.clock`); os eventos são
  disparados pela API de controle do servidor simulado.
- Relatório HTML em `reports/playwright`; traces mantidos para falhas (`test-results`).
- **Baselines visuais** em `tests/e2e/__screenshots__`, geradas em Linux com dados estáveis. Em outro
  sistema operacional, a renderização de texto difere: rode a regressão visual no contêiner oficial do
  Playwright (ver guia do Windows) ou gere baselines locais com `npm run test:visual:update`.

Rodada final desta entrega (30/10/2026): **114 testes E2E e 8 de regressão visual passaram**; 2 casos são
ignorados de propósito por viewport (navegação por teclado físico só no desktop; drawer de navegação só no
mobile). O ZIP inclui o relatório HTML dessa rodada em `reports/playwright`.

Cobertura: busca, filtros combinados, ordenação, paginação e histórico; acesso direto e 404; cadastro,
login, expiração, logout e troca de usuário; favoritos com falha e rollback; carrinho (quantidades,
remoção, cupom, persistência após refresh/login); compra completa até o recibo; pagamento recusado,
clique repetido e timeout com recuperação; perfil, avatar, senha e carteiras com erros; preço e
disponibilidade via Socket.IO no checkout; eventos duplicados/antigos, desconexão e pedido pendente;
teclado, foco de diálogos e formulários; skeletons, falha e nova tentativa; overflow em 320–1440 px.

## Auditoria Lighthouse

```bash
npm run lighthouse
```

Build otimizado + `vite preview` + **3 medições por página (início e detalhe do NFT) e perfil (mobile e
desktop)**, cada uma em processo e perfil de navegador novos, no cenário padrão dos mocks. Configuração
versionada em [`lighthouse/`](lighthouse); relatórios HTML/JSON e resumo com medianas, LCP/CLS/TBT,
versões e condições em `lighthouse/reports/`. Resultados e análise: [lighthouse/README.md](lighthouse/README.md).

| Página | Perfil | Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | --- | --- | --- |
| Início | mobile | 75 | 100 | 100 | 100 |
| Detalhe | mobile | 73 | 100 | 100 | 100 |
| Início | desktop | 100 | 100 | 100 | 100 |
| Detalhe | desktop | 99 | 100 | 100 | 100 |

Medianas de 3 medições (CLS 0 em todas). A Performance mobile fica abaixo da meta de 90; as causas
(LCP dependente de dados, ~270 KB de JavaScript inicial da stack e da simulação no navegador, throttling
simulado de 4G lento + CPU 4×) e o que foi otimizado estão no relatório de análise.

## Estrutura

```text
src/
  api/          contratos zod, cliente Axios, normalização de erros, endpoints tipados
  app/          QueryClient (cache, retries)
  queries/      hooks do TanStack Query e fábrica de chaves
  session/      sessão, expiração, armazenamento do token
  realtime/     cliente Socket.IO (dedupe, versão, reconexão, reconciliação)
  features/     telas: catalog, nft, cart, checkout, orders, auth, account, system
  components/   layout, componentes de NFT e shadcn/ui
  mocks/        MSW: banco simulado, handlers REST, Socket.IO, cenários, painel e API de controle
  lib/          formatação, armazenamento, idempotência, anúncios acessíveis
tests/e2e/      specs, fixtures e baselines visuais
lighthouse/     configuração da auditoria e relatórios
scripts/        geração de assets/ícones/fixtures e auditoria
docs/           contratos REST/eventos e guia do Windows
```

## Deploy

Vercel (recomendado): importe o repositório; o [`vercel.json`](vercel.json) define build
(`npm run build:demo`), saída `dist`, fallback de rotas (acesso direto e refresh) e cabeçalhos do
service worker. Netlify/Cloudflare Pages: comando `npm run build:demo`, pasta `dist`
(`public/_redirects` faz o fallback). Publique com o `package-lock.json` gerado pelo `npm install`.

## Segurança

O endurecimento do site contra invasão (CSP, cabeçalhos de segurança, política de armazenamento do
token, etc.) é tratado à parte pelo responsável do projeto. Os pontos de extensão estão descritos em
[ARCHITECTURE.md](ARCHITECTURE.md#segurança-pontos-de-extensão).

## Assets

As imagens dos NFTs são **retratos originais gerados por script** (`scripts/generate-art.mjs`) e a fonte
é a JetBrains Mono auto-hospedada (`public/fonts`), substituindo os assets do arquivo de layout.
Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md#desvios-do-layout-e-substituição-de-assets).
