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
| Deploy | ✅ | Vercel: https://e-commerce-zeta-six-24.vercel.app · repositório https://github.com/EduardoHenrique90111/E-Commerce |

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
| E2E Playwright desktop + mobile | ✅ | ver rodada final abaixo |
| Regressão visual (início, detalhe, carrinho, pagamento) | ✅ | 8 baselines estáveis |
| CLS | ✅ | 0 em todas as medições Lighthouse |
| Lighthouse | ✅ | `scripts/lighthouse.mjs`, configs versionadas, relatórios em `lighthouse/reports`, análise em `lighthouse/README.md` |
| ESLint (flat config) | ✅ | núcleo verificado localmente; plugins verificados por buscas dirigidas (sem acesso ao npm aqui) |
| README / ARCHITECTURE / docs/API.md / docs/GUIA-WINDOWS.md | ✅ | |
| ZIP final | ✅ | `kurio-entrega.zip` (gerado de `git archive` + relatórios) |

### Lighthouse — medianas finais (30/10, 3 medições por página/perfil)

| Página | Perfil | Perf | A11y | BP | SEO | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Início | mobile | 75 | 100 | 100 | 100 | 3,81 s | 457 ms | 0 |
| Detalhe | mobile | 73 | 100 | 100 | 100 | 3,78 s | 539 ms | 0 |
| Início | desktop | 100 | 100 | 100 | 100 | 0,80 s | 32 ms | 0 |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 0,93 s | 49 ms | 0 |

Performance mobile abaixo de 90: causas e otimizações documentadas em `lighthouse/README.md`.

## Pendências para o usuário

1. ~~`npm install` / lockfile~~ — feito (lockfile versionado).
2. ~~`npm run lint`~~ — feito: 0 erros e 0 avisos.
3. ~~Deploy~~ — feito; opcional: `npm run lighthouse -- --url=https://e-commerce-zeta-six-24.vercel.app`.
4. ~~Segurança~~ — feito em 30/10 (ver abaixo).

## Segurança (30/10, noite)

| Item | Status |
| --- | --- |
| CSP restritiva + HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP (`vercel.json`, `public/_headers`, `vite preview`) | ✅ |
| Bloqueio temporário do login após 5 senhas erradas (429 + Retry-After) | ✅ |
| `tests/e2e/security.spec.ts`: cabeçalhos, jornada sem violações de CSP, bloqueio de login | ✅ |
| Documentação (ARCHITECTURE.md §16, README) | ✅ |
