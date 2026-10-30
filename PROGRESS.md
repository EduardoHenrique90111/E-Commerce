# PROGRESS — Kurio (marketplace de NFTs)

Última atualização: 29/10/2026 22:55 (America/Sao_Paulo)

Legenda: ✅ concluído e verificado no navegador · 🟡 implementado, verificação pendente · ⏳ pendente

## Ambiente de desenvolvimento desta entrega

O ambiente em nuvem onde o projeto está sendo construído não tem acesso ao registro do npm.
Para compilar e testar aqui, as bibliotecas da stack (TanStack, MSW, Socket.IO, Radix, sonner) foram
compiladas a partir do código-fonte público no GitHub, apenas para verificação local (fora do projeto).
O `package.json` do projeto usa as versões publicadas no npm; o `package-lock.json` é gerado no primeiro
`npm install` na máquina do usuário (ver README → Guia Windows).

## Infraestrutura

| Item | Status | Observações |
| --- | --- | --- |
| Projeto Vite + React 19 + TypeScript (strict) | ✅ | `tsconfig.app.json` / `tsconfig.node.json`, alias `@/` |
| Tailwind CSS v4 + tokens do Figma | ✅ | `src/styles/globals.css` (cores, raio, shimmer, reduced motion) |
| shadcn/ui (componentes adaptados) | ✅ | `src/components/ui/*`, `components.json` |
| Ícones (Lucide, gerados localmente) | ✅ | `scripts/generate-icons.mjs` → `src/components/icons.tsx` |
| Fonte auto-hospedada (JetBrains Mono) | ✅ | `public/fonts` (substitui a fonte do Figma) |
| Arte substituta (48 retratos originais) | ✅ | `scripts/generate-art.mjs` → `public/images/nfts/*.webp` |
| Fixtures determinísticas (catálogo) | ✅ | `scripts/generate-catalog.mjs` → `src/mocks/fixtures/catalog.json` |
| Deploy (Vercel/Netlify/CF Pages) | 🟡 | `vercel.json`, `public/_redirects`; deploy feito pelo usuário |

## Contratos e camada de dados

| Item | Status | Observações |
| --- | --- | --- |
| Contratos tipados (zod) REST + eventos | ✅ | `src/api/contracts.ts` (compartilhado com os mocks) |
| Cliente Axios + normalização de erros | ✅ | `src/api/client.ts`, `src/api/errors.ts` |
| Endpoints tipados | ✅ | `src/api/endpoints.ts` |
| TanStack Query (política de cache/retry) | ✅ | `src/app/query-client.ts`, `src/queries/*` |
| Sessão (login, logout, expiração, multi-aba) | 🟡 | `src/session/*`, `SessionWatcher` |
| Tempo real (socket.io-client) dedupe/versão/reconciliação | 🟡 | `src/realtime/*` (conexão verificada ✅) |

## Mocks (MSW)

| Item | Status | Observações |
| --- | --- | --- |
| Banco simulado persistente + reset | ✅ | `src/mocks/db.ts` (localStorage, seed determinístico) |
| Handlers REST: auth, NFTs, favoritos, carrinho, cotação, pedidos, perfil, carteiras | 🟡 | `src/mocks/handlers/*` (catálogo verificado ✅) |
| Idempotência de pedidos + ciclo pendente/confirmado/recusado | 🟡 | `src/mocks/handlers/orders.ts`, `src/mocks/domain.ts` |
| Cenários de rede e falhas (16 cenários) | 🟡 | `src/mocks/config.ts`, `src/mocks/http.ts` |
| Socket.IO simulado (@mswjs/socket.io-binding) | ✅ | `src/mocks/realtime.ts` (cliente conecta via MSW) |
| API de controle `window.__KURIO_MOCK__` | 🟡 | `src/mocks/control.ts` |
| Painel "Simulação" na interface | ⏳ | `src/mocks/devtools/mock-devtools.tsx` (stub) |

## Telas

| Tela | Status |
| --- | --- |
| Início (hero, catálogo, busca, filtros, ordenação, paginação, skeletons) | ✅ desktop · 🟡 mobile/tablet |
| Detalhe do NFT (galeria, edições, quantidade, favoritos, compra, relacionados, 404) | 🟡 |
| Carrinho (quantidade otimista, remoção, cupom, resumo, alertas de preço) | 🟡 |
| Pagamento (dados, carteira/rede, conexão, revisão, idempotência, timeout) | 🟡 |
| Confirmação / status do pedido (pendente, confirmado, recusado, 403/404) | 🟡 |
| Meus pedidos | 🟡 |
| Login / Cadastro | ⏳ (stub) |
| Perfil (dados, avatar, senha) | ⏳ (stub) |
| Carteiras (principal e secundária) | ⏳ (stub) |
| Favoritos | ⏳ (stub) |
| Página 404 | ✅ |

## Qualidade

| Item | Status |
| --- | --- |
| Typecheck (tsc strict) | ✅ sem erros no estado atual |
| Build de produção | ✅ (bundler local; Vite no projeto) |
| Testes Playwright (E2E + regressão visual) | ⏳ |
| Auditoria Lighthouse (3 medições, mediana) | ⏳ |
| README.md / ARCHITECTURE.md / docs/API.md / Guia Windows | ⏳ |
| ZIP final | ⏳ |

## Próximos passos

1. Login/Cadastro, Perfil, Carteiras, Favoritos, layout da conta.
2. Painel de simulação (cenários, reset, eventos).
3. Verificação manual de todos os fluxos no navegador (desktop e mobile).
4. Testes Playwright (todos os itens da seção 9 do enunciado) + baselines visuais.
5. Lighthouse (início e detalhe, mobile e desktop).
6. Documentação e ZIP final.
