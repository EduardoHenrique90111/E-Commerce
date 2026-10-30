# PROGRESS — Kurio (marketplace de NFTs)

Última atualização: 30/10/2026 (America/Sao_Paulo)

Legenda: ✅ concluído e verificado · 🟡 implementado, verificação pendente · ⏳ pendente

## Ambiente de desenvolvimento desta entrega

O ambiente em nuvem onde o projeto foi construído não tem acesso ao registro do npm. Para compilar e
testar aqui, as bibliotecas da stack foram compiladas a partir do código-fonte público no GitHub, apenas
para verificação local (fora do projeto), com um bundler equivalente ao Vite. O `package.json` do projeto
usa as versões publicadas no npm; o `package-lock.json` é gerado no primeiro `npm install` (ver
`docs/GUIA-WINDOWS.md`).

## Infraestrutura

| Item | Status | Observações |
| --- | --- | --- |
| Vite + React 19 + TypeScript (strict) | ✅ | `tsconfig.*.json`, alias `@/` |
| Tailwind CSS v4 + tokens do layout | ✅ | `src/styles/globals.css` (cores, raio, shimmer, reduced motion) |
| shadcn/ui adaptado à identidade | ✅ | `src/components/ui/*`, `components.json` |
| Ícones Lucide gerados localmente | ✅ | `scripts/generate-icons.mjs` |
| Fonte auto-hospedada (JetBrains Mono) | ✅ | `public/fonts` |
| Arte substituta (retratos originais) | ✅ | `scripts/generate-art.mjs` → `public/images/nfts/*.webp` |
| Fixtures determinísticas | ✅ | `scripts/generate-catalog.mjs`, `src/mocks/fixtures/*` |
| Deploy | 🟡 | `vercel.json`, `public/_redirects`; publicação feita pelo usuário |

## Dados, estado e tempo real

| Item | Status |
| --- | --- |
| Contratos zod compartilhados (REST + eventos) | ✅ |
| Axios (adaptador fetch, sem cookies), erros normalizados | ✅ |
| TanStack Query: cache, retries, isolamento por usuário, otimista + rollback | ✅ |
| TanStack Router: rotas, search params, rotas privadas, 404, retorno pós-login | ✅ |
| Sessão: refresh, expiração (navegação e checkout), logout, troca de usuário | ✅ |
| Socket.IO: dedupe, versão, reconexão + reconciliação REST, isolamento por sessão | ✅ |
| Barreira `networkReady()` (UI monta antes do MSW; REST/socket aguardam) | ✅ |

## Mocks (MSW)

| Item | Status |
| --- | --- |
| Banco simulado persistente + reset por URL/painel | ✅ |
| Handlers REST de todos os recursos (auth, NFTs, favoritos, carrinho, cotação, pedidos, perfil, carteiras) | ✅ |
| Idempotência (mesma chave → mesmo pedido; conteúdo diferente → 409) | ✅ |
| 16 cenários de rede/falha determinísticos | ✅ |
| Socket.IO via @mswjs/socket.io-binding (nft.updated, order.updated) | ✅ |
| API de controle `window.__KURIO_MOCK__` + painel "Simulação" | ✅ |

## Telas (desktop, tablet e mobile)

| Tela | Status |
| --- | --- |
| Início, Detalhe, Carrinho, Pagamento, Confirmação, Pedidos | ✅ |
| Login, Cadastro, Perfil (dados, avatar, senha), Carteiras, Favoritos | ✅ |
| 404 e recurso inexistente | ✅ |

## Qualidade

| Item | Status | Observações |
| --- | --- | --- |
| Typecheck | ✅ | sem erros |
| E2E Playwright desktop + mobile | ✅ | 114 passaram, 2 ignorados de propósito (30/10) |
| Regressão visual (início, detalhe, carrinho, pagamento) | ✅ | 8 baselines, estáveis |
| CLS | ✅ | 0 em início e detalhe (desktop e mobile) |
| Lighthouse | 🟡 | medições em andamento; script `scripts/lighthouse.mjs` ⏳ |
| ESLint (flat config) | ⏳ | `eslint.config.js` |
| README / ARCHITECTURE / docs/API.md / docs/GUIA-WINDOWS.md | ⏳ | |
| ZIP final | ⏳ | |

### Lighthouse — medições parciais (30/10, build otimizado, cenário padrão)

| Página | Perfil | Perf | A11y | BP | SEO |
| --- | --- | --- | --- | --- | --- |
| Início | mobile | 77–80 | 100 | 100 | 100 |
| Início | desktop | 99 | 100 | 100 | 100 |
| Detalhe | mobile | 74–78 | 100 | 100 | 100 |
| Detalhe | desktop | 95–99 | 100 | 100 | 100 |

Otimizações aplicadas: handler de passagem para recursos não-API no MSW, Axios sem cookies,
renderização adiada (useDeferredValue) das listas, montagem inicial como transição, socket e painel
de simulação carregados quando ocioso, filtros laterais só no desktop, correção de CLS no detalhe.

## Próximos passos (na ordem)

1. `scripts/lighthouse.mjs` + `lighthouse/config.{mobile,desktop}.mjs`; 3 medições por página/perfil,
   medianas, relatórios HTML/JSON em `lighthouse/reports`, resumo com LCP/CLS/TBT, versões e ambiente.
2. `eslint.config.js`; remover `autoFocus` do SearchBox (jsx-a11y/no-autofocus).
3. README.md, ARCHITECTURE.md, docs/API.md, docs/GUIA-WINDOWS.md.
4. Rodada final: typecheck, E2E, visual; commit; ZIP (sem node_modules/dist/test-results).
