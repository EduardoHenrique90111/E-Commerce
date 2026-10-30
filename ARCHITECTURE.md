# Arquitetura — Kurio

Este documento registra as decisões técnicas, as políticas de sessão, carrinho, cache e tempo real,
as limitações da simulação, as decisões de UX e os desvios em relação ao layout. Os contratos estão
em [docs/API.md](docs/API.md).

## 1. Visão geral

```text
 Interface (React + shadcn/ui + Tailwind)
   │  hooks de dados (src/queries/*)          eventos aplicados ao cache (src/realtime/apply.ts)
   ▼                                            ▲
 TanStack Query ── cache por chave ─────────────┤
   │  queryFn/mutationFn                        │
   ▼                                            │
 api/endpoints.ts → api/client.ts (Axios)    realtime/client.ts (socket.io-client)
   │  REST /api/*                                │  WebSocket /socket.io
   ▼                                            ▼
 ──────────────── camada de rede do navegador ────────────────
   MSW (service worker → handlers REST)      MSW ws.link + @mswjs/socket.io-binding
   └──────────── backend simulado: src/mocks/db.ts (estado único) ────────────┘
```

- **Uma fonte de contratos** (`src/api/contracts.ts`, zod): tipos inferidos para cliente, cache e
  interface; os mesmos schemas validam os corpos nos handlers do MSW.
- **Nenhuma resposta fictícia fora da camada de rede.** Componentes, hooks e o cliente Axios não têm
  dados simulados nem caminhos alternativos de negócio: com `VITE_ENABLE_MOCKS=false`, o mesmo código
  falaria com uma API real nos mesmos contratos.
- **Backend simulado consistente**: catálogo, contas, sessões, carrinhos, favoritos, carteiras, cotações,
  pedidos e chaves de idempotência vivem num único estado (`src/mocks/db.ts`). Toda mudança passa por
  funções de domínio (`src/mocks/domain.ts`) que atualizam o estado e publicam o evento correspondente —
  REST e Socket.IO sempre refletem a mesma versão dos dados.

## 2. Inicialização

`src/main.tsx` carrega, em paralelo, a camada de mocks (chunk próprio) e a aplicação. A interface monta
imediatamente (shell e skeletons visíveis sem esperar o service worker). As chamadas REST (interceptor
do Axios) e a conexão Socket.IO aguardam a barreira `networkReady()` (`src/lib/network-ready.ts`),
liberada quando o MSW está interceptando — nenhuma requisição escapa para a rede real antes disso. Sem
mocks, a barreira é liberada na inicialização. Os parâmetros `?scenario=` e `?reset=1` são lidos e
removidos da URL antes da criação do router, para não entrarem no estado de navegação.

Trabalho fora do caminho crítico — conexão de tempo real e painel de simulação — é iniciado quando o
navegador fica ocioso (`requestIdleCallback`). Rotas secundárias (carrinho, pagamento, pedidos, conta,
login/cadastro) são carregadas sob demanda.

## 3. Rotas (TanStack Router)

| Rota | Tela | Acesso |
| --- | --- | --- |
| `/` | Início: destaques, catálogo, busca, filtros, ordenação, paginação | público |
| `/nft/$nftId` | Detalhe: galeria, informações, edição, quantidade, favorito, compra, relacionados | público |
| `/carrinho` | Carrinho (visitante ou conta) | público |
| `/entrar`, `/cadastro` | Login e cadastro (com `?redirect=` para retomar o fluxo) | público |
| `/pagamento` | Dados do colecionador, carteira e rede, revisão e envio | privado |
| `/pedidos`, `/pedidos/$orderId` | Pedidos; status e recibo | privado |
| `/perfil`, `/perfil/carteiras`, `/favoritos` | Conta do colecionador | privado |
| qualquer outra | Página não encontrada | — |

- **Search params tipados** (`validateSearch`): busca, coleções, redes, faixa de preço, ordenação e
  página vivem na URL — filtros podem ser compartilhados, o histórico restaura o estado e o acesso direto
  funciona.
- **Rotas privadas** ficam sob o layout `_auth`, cujo `beforeLoad` garante a sessão (consulta
  `GET /api/auth/session` pelo cache do Query) e, sem sessão, redireciona para `/entrar?redirect=<rota>`.
  O retorno aceita apenas caminhos internos (`safeRedirect`).
- **Loaders** pré-carregam os dados da rota no cache do Query (catálogo, NFT e relacionados), em paralelo
  com o carregamento do código.
- Recurso inexistente (ex.: NFT 404) mostra uma tela própria; erros inesperados de rota caem no
  `errorComponent`.

## 4. Transporte, contratos e erros

- **Axios** (`src/api/client.ts`) é o único cliente HTTP: injeta `Authorization`, `X-Cart-Id` (visitante),
  normaliza erros em `ApiError` (`http`, `network`, `timeout`, `canceled`, `invalid-response`) e avisa o
  controlador de sessão sobre `401`. Usa o adaptador `fetch` com `credentials: 'omit'` — a API é
  autenticada por token, não por cookie.
- **Validação de resposta**: toda resposta passa pelo schema zod do recurso (`request(config, schema)`).
- **Timeouts**: 10 s por padrão; 6 s na criação de pedido (a recuperação é feita por reenvio idempotente).
- **Cancelamento e respostas obsoletas**: as queries repassam o `AbortSignal` do TanStack Query ao Axios.
  Mudar a busca ou os filtros cancela a requisição anterior, e cada resposta é guardada na chave da sua
  própria consulta — uma resposta atrasada nunca sobrescreve a consulta atual (cenário `out-of-order`).

## 5. Estado remoto e cache (TanStack Query)

**Chaves** (`src/queries/keys.ts`): dados públicos em `['nfts', …]`; carrinho em `['cart', dono]`
(dono = usuário ou visitante); cotação em `['cart', dono, 'quote', rede, impressão-do-carrinho]`, onde a
impressão inclui a versão do carrinho e a versão de cada NFT; **todos os dados privados em
`['user', userId, …]`** — isolados por usuário e removidos de uma vez no logout.

| Dado | `staleTime` | Observações |
| --- | --- | --- |
| padrão (catálogo, detalhe, pedidos, perfil, carteiras, favoritos) | 30 s | refetch ao focar a janela e ao reconectar; catálogo e detalhe também atualizados por `nft.updated` |
| destaques e relacionados | 60 s | atualizados por `nft.updated` |
| carrinho | 10 s | versão do servidor: respostas mais antigas não sobrescrevem as mais novas |
| cotação | 15 s | chave muda quando carrinho, cupom, rede ou versão de algum NFT muda |
| sessão | 5 min | revalidada a cada carregamento; 401 encerra a sessão |
| pedido pendente | — | `refetchInterval` de 5 s enquanto `pending` (complementa o evento) |

**Retries**: somente falhas transitórias (rede, timeout, 5xx, 429), até 2 novas tentativas com backoff
exponencial (400 ms → 3 s). Erros 4xx e cancelamentos nunca são repetidos. Mutations não têm retry
automático; a criação de pedido tem reenvio controlado pelo checkout com a mesma chave de idempotência.

**Estados de interface**: carregamento (skeletons com shimmer), vazio, erro com nova tentativa, sucesso e
atualização em segundo plano (indicador "Atualizando…" mantendo os dados anteriores visíveis via
`placeholderData`). Listas grandes são renderizadas a partir de `useDeferredValue`, o que permite ao React
montá-las fatiadas sem bloquear o thread principal.

**Invalidação coerente**:

| Origem | Efeito no cache |
| --- | --- |
| adicionar/alterar/remover item, cupom | resposta do servidor grava o carrinho; cotação muda de chave |
| favoritar/desfavoritar | atualização otimista; resposta grava a lista; `onSettled` invalida |
| perfil, avatar, carteiras | resposta grava o recurso; listas relacionadas invalidadas |
| pedido criado/confirmado | pedido e lista do usuário; carrinho invalidado (itens comprados saem) |
| `nft.updated` | detalhe, listas, relacionados e favoritos atualizados no lugar; carrinho invalidado |
| `order.updated` | pedido atualizado no lugar; lista de pedidos e carrinho invalidados |
| reconexão do Socket.IO | catálogo, carrinho e pedidos ativos revalidados pela API REST |

**Atualização otimista com rollback** em duas interações: favoritos e quantidade de itens no carrinho.
O estado anterior é guardado em `onMutate`; em falha volta ao snapshot e um aviso acessível é anunciado
(cenário `favorites-failure`).

## 6. Sessão

- **Token** opaco emitido no login/cadastro, guardado por `src/session/token-store.ts` (ponto único de
  troca do mecanismo — ver Segurança) para sobreviver a refresh. A sessão é sempre validada no servidor
  ao carregar (`GET /api/auth/session`).
- **Expiração** tratada em três frentes (`SessionWatcher`): resposta `401 SESSION_EXPIRED`, timer até
  `expiresAt` e login/logout feito em outra aba (evento `storage`). Em rota privada, o usuário vai para
  `/entrar?redirect=<rota>&reason=expired`; depois do login volta ao ponto em que estava.
- **Checkout preservado**: o rascunho do pagamento (dados do colecionador, carteira, rede) fica em
  `sessionStorage` por usuário e sobrevive à expiração; é restaurado quando o mesmo usuário entra de novo.
- **Logout e troca de usuário**: cancelam e removem todas as queries `['user', …]` e o carrinho do cache,
  apagam rascunhos e o registro de pedido pendente, e reabrem a conexão Socket.IO como a nova sessão
  (a anterior é encerrada com seus listeners). Nada de um usuário fica visível para o próximo.

## 7. Carrinho

- Visitantes têm carrinho no servidor identificado por `X-Cart-Id` (gerado pelo servidor, guardado no
  navegador). No login, o servidor une o carrinho de visitante ao da conta, respeitando disponibilidade e o
  máximo de 5 por pedido.
- Cada linha guarda o preço atual, o preço de quando entrou e a versão do NFT: o carrinho sinaliza "preço
  alterado (era X)" e "esgotado", e o botão de finalizar fica bloqueado enquanto houver item indisponível.
- O carrinho tem `version`; respostas fora de ordem não regridem o estado.
- O resumo de valores vem da **cotação** do servidor (subtotal, desconto do cupom, taxa de serviço de 2,5%,
  taxa de rede e total) — a interface não recalcula preços.

## 8. Pagamento e pedidos

1. **Formulário** validado com os mesmos schemas da API (nome, e-mail, observação, carteira, rede); erros
   associados aos campos e foco no primeiro inválido.
2. **Carteiras cadastradas** (principal/secundária) e seleção de rede; conexão simulada com recusa
   (`wallet-reject`) e desconexão (painel). O envio exige a carteira conectada na rede escolhida.
3. **Revisão**: o diálogo pede uma cotação nova ao abrir e mostra itens, desconto, taxas e total, além de
   um aceite explícito. Se a cotação ficar desatualizada (evento de preço/disponibilidade, cupom, rede), o
   aceite é desmarcado, a confirmação é bloqueada e o usuário precisa atualizar e confirmar de novo.
4. **Envio idempotente**: a chave de idempotência é derivada da tentativa (impressão canônica do conteúdo,
   guardada em `sessionStorage`). Cliques repetidos são ignorados enquanto há envio em andamento; após
   timeout, refresh ou reconexão, o reenvio usa a **mesma chave** e o servidor devolve o mesmo pedido.
   Conteúdo diferente gera chave nova.
5. **Revalidação no servidor**: antes de criar o pedido, o servidor confere preço, disponibilidade, cupom e
   taxas. Mudanças retornam `409` com a cotação nova, que exige nova confirmação.
6. **Ciclo do pedido**: `pending` → `confirmed` | `rejected` (terminais). A tela de status acompanha o pedido
   por `order.updated`, com consulta periódica como reserva. O pedido pendente é lembrado por usuário e
   retomado após refresh ou reconexão (faixa "Acompanhar pedido"). A tela de confirmação só aparece para
   pedido **confirmado** pelo servidor simulado.
7. **Carrinho após a compra**: em falha nada sai do carrinho; na confirmação, o servidor remove apenas os
   itens e quantidades comprados (itens adicionados depois permanecem).
8. **Recibo**: reproduz o snapshot do pedido (itens, preços unitários, desconto, taxas, total, carteira,
   rede). Mudanças posteriores no catálogo não alteram o recibo. Hash de transação e link do explorador são
   simulados.

## 9. Tempo real (Socket.IO)

- `src/realtime/client.ts`: uma conexão por sessão (geração). Login, logout e troca de usuário encerram a
  conexão anterior e removem todos os listeners; eventos que chegam de uma geração antiga são descartados.
- **Identidade, recurso e versão** em todos os eventos. O cliente ignora duplicatas (`id` já visto) e eventos
  com versão menor ou igual à última conhecida do recurso — sem regredir o estado nem repetir avisos.
  Pedidos em estado terminal não voltam a `pending`.
- **Isolamento por usuário**: o servidor simulado só entrega `order.updated` às conexões do dono
  (autenticadas pelo token no pacote de conexão), e o cliente ainda confere o `userId` do evento.
- **Aplicação**: `nft.updated` atualiza preço e disponibilidade no detalhe, no catálogo, nos relacionados e
  nos favoritos, e revalida o carrinho e a cotação; `order.updated` atualiza o pedido e, se confirmado,
  o carrinho. Cada alteração aplicada gera aviso visual (toast) e anúncio em região `aria-live`.
- **Reconexão**: ao reconectar, os recursos ativos são reconciliados pela API REST (eventos podem ter sido
  perdidos durante a queda). O indicador de conexão mostra conectando/reconectando/offline.
- A primeira conexão da página é aberta quando o navegador fica ocioso. Eventos desse curto intervalo não
  produzem estado incorreto: pedidos pendentes também são consultados periodicamente e a cotação é sempre
  revalidada no servidor antes da compra.

## 10. Camada de mocks (MSW)

| Peça | Arquivo |
| --- | --- |
| Inicialização do worker | `src/mocks/browser.ts` |
| Estado e persistência | `src/mocks/db.ts` (localStorage; reset restaura o seed determinístico) |
| Regras de domínio e eventos | `src/mocks/domain.ts`, `src/mocks/events.ts` |
| Handlers REST | `src/mocks/handlers/*` |
| Rede simulada (latência, falhas, timeout, offline) | `src/mocks/http.ts` |
| Cenários | `src/mocks/config.ts` |
| Servidor Socket.IO | `src/mocks/realtime.ts` |
| API de controle e painel | `src/mocks/control.ts`, `src/mocks/devtools/*` |
| Fixtures | `src/mocks/fixtures/*` (48 NFTs em 8 coleções e 3 redes, 3 usuários, cupons, taxas) |

- **Ativação por configuração**: `VITE_ENABLE_MOCKS=true` (presente em `.env` e `.env.production`); a camada
  vai no build de demonstração publicado.
- **Determinismo**: latência variável sorteada por PRNG com semente fixa; contadores por cenário; o reset
  restaura integralmente o seed. Os mesmos cenários servem desenvolvimento, demonstração e testes.
- **Consistência entre abas**: o estado persistido é recarregado quando outra aba o altera.
- **Recursos não-API**: o primeiro handler devolve à rede, sem avaliar os demais, toda requisição que não
  seja `/api/*` (scripts, imagens, fontes) — o service worker do MSW encaminha todas as requisições da
  página, e avaliar dezenas de handlers por imagem custava tempo de CPU na carga.

### Transporte do Socket.IO simulado e limitações

O MSW intercepta o construtor global `WebSocket` (com `ws.link`) e o `@mswjs/socket.io-binding` implementa
o protocolo Engine.IO/Socket.IO sobre a conexão interceptada. O cliente real `socket.io-client` conversa
com esse "servidor" como faria com um servidor de produção.

- Transporte **somente WebSocket** (`transports: ['websocket']`): o long-polling do Engine.IO não é simulado.
- O `ws.link` é registrado na **origem** da página: o MSW descarta o caminho `/socket.io/` ao casar a URL do
  WebSocket.
- O `socket.io-client` é importado **depois** de o MSW iniciar, porque o Engine.IO captura a referência de
  `WebSocket` ao carregar o módulo.
- Apenas o namespace padrão; sem acks, salas ou mensagens binárias. A autenticação é lida do pacote de
  conexão (`40{"token":…}`); o servidor envia heartbeats Engine.IO (`2`).
- O "servidor" vive na aba: cada aba tem suas conexões; o estado de dados é compartilhado pelo
  `localStorage`.
- Service workers exigem contexto seguro (HTTPS ou `localhost`). Na primeira visita o worker é registrado
  antes das primeiras chamadas (barreira `networkReady`).

## 11. Interface, responsividade e acessibilidade

- **Identidade visual**: tokens de cor, raio, tipografia e espaçamento em `src/styles/globals.css`
  (Tailwind 4); componentes shadcn/ui adaptados (botões, campos, diálogos, drawers, abas, toasts).
- **Responsividade** avaliada em 320, 390, 768 e 1440 px, sem overflow horizontal (verificado por teste).
  Abaixo de 1024 px os filtros ficam num drawer; a navegação vira barra inferior no mobile.
- **Skeletons com shimmer** no catálogo, detalhe e resumo do carrinho, com as mesmas dimensões do conteúdo
  (CLS 0 nas páginas auditadas). O shimmer e as transições respeitam `prefers-reduced-motion`.
- **Teclado e foco**: link "pular para o conteúdo", foco visível em todos os controles, foco preso e
  devolvido em diálogos e drawers (Radix), foco no primeiro campo inválido.
- **Semântica**: landmarks, títulos hierárquicos, `label` associado a cada campo, mensagens de erro ligadas
  por `aria-describedby`, grupos de rádio para edição, carteira e rede, textos alternativos descritivos nas
  imagens relevantes (decorativas com `alt=""`).
- **Feedback acessível**: mutations e eventos em tempo real anunciados numa região `aria-live` (educada ou
  assertiva conforme a gravidade), além do toast visual. Estados nunca dependem só de cor (texto/ícone).
- **Ajustes em relação ao layout**: alvos de toque de no mínimo 24 px nos links do rodapé (WCAG 2.5.8) e
  rótulos visíveis ou acessíveis em todos os controles de ícone.

## 12. Performance

A análise completa está em [lighthouse/README.md](lighthouse/README.md). Decisões principais: rotas
secundárias sob demanda; mocks e Socket.IO fora do caminho crítico; imagens responsivas (`srcset` de 320 a
960 px em WebP, dimensões declaradas, prioridade alta para a imagem do hero e a primeira linha do catálogo,
`lazy` para as demais); fonte auto-hospedada com `preload` e `font-display: swap`; renderização adiada das
listas; montagem inicial como transição; cabeçalhos de cache imutável para `assets/` e `fonts/`.

## 13. Testes

Playwright com quatro projetos (`desktop-chromium`, `mobile-chromium`, `visual-desktop`, `visual-mobile`)
contra o build de demonstração. A fixture (`tests/e2e/fixtures.ts`) isola cada teste (contexto novo,
cenário definido antes do carregamento, dados restaurados), controla latência e liquidação pela
configuração dos mocks, usa `page.clock` para expiração natural de sessão e dispara eventos pela API de
controle do servidor simulado — que passam pelo `socket.io-client`. As verificações observam a interface e
o resultado das operações (ex.: quantidade de pedidos criados no servidor simulado).

## 14. Decisões de UX

- Filtros, busca, ordenação e página na URL: compartilháveis e restaurados pelo histórico; busca com
  debounce, e cada termo confirmado vira uma entrada no histórico.
- Preço e disponibilidade alterados são mostrados no próprio item ("era X", "esgotado") além do aviso.
- A revisão do pedido é um diálogo com aceite explícito; qualquer mudança de valores desmarca o aceite.
- Pedido pendente acompanha a navegação (faixa "Acompanhar pedido") até ficar terminal.
- O login preserva o destino (`redirect`) e, na expiração, explica o motivo.
- Painel **Simulação** visível na demonstração para avaliar cenários sem ferramentas externas.

## 15. Desvios do layout e substituição de assets

- **Imagens**: os NFTs usam retratos originais gerados por script (`scripts/generate-art.mjs`) em WebP
  (320/640/960 px), em vez das artes do arquivo de layout, mantendo proporções (1:1) e composição.
- **Fonte**: JetBrains Mono auto-hospedada (`public/fonts`, subset latino), monoespaçada como a tipografia do
  layout, servida localmente para a execução offline e a auditoria.
- **Ícones**: Lucide, gerados localmente (`scripts/generate-icons.mjs`).
- **Elementos acrescentados por requisito**: indicador de conexão em tempo real, faixa de pedido pendente,
  avisos de preço/esgotamento, painel de simulação e estados de carregamento/erro/vazio.
- **Mobile e tablet**: filtros em drawer, navegação inferior e empilhamento da galeria do detalhe
  (miniaturas abaixo da imagem principal).
- Artigos do "Diário da Cunhagem" não têm página de destino (marcados "Em breve no Diário").

## 16. Segurança (pontos de extensão)

O endurecimento contra invasão é responsabilidade do dono do projeto. A aplicação já não guarda senhas
(apenas hash PBKDF2 no servidor simulado), valida todas as entradas com zod, aceita só redirecionamentos
internos e não usa `dangerouslySetInnerHTML`. Pontos para a camada de segurança:

- `src/session/token-store.ts`: troque o `localStorage` por cookie `HttpOnly` + `SameSite` com uma API real
  (nesse caso, ajuste `withCredentials` em `src/api/client.ts`).
- `vercel.json` (e `public/_headers`, se usar Netlify/Cloudflare): cabeçalhos como CSP,
  `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`. Uma CSP
  precisa permitir o service worker do MSW (`worker-src 'self'`) enquanto os mocks estiverem ativos.
- `src/api/client.ts`: interceptores para CSRF/assinatura de requisições, se o backend real exigir.

## 17. Limitações conhecidas

- Tudo é simulado no navegador: dados ficam no `localStorage` de cada navegador; não há servidor real.
- Socket.IO simulado com as limitações da seção 10.
- As baselines visuais foram geradas em Linux; em outro sistema, use o contêiner do Playwright ou gere
  baselines locais.
- Ambiente de construção desta entrega sem acesso ao registro npm: o `package-lock.json` é gerado no primeiro
  `npm install` (ver README); os relatórios Lighthouse versionados foram gerados com um build equivalente
  (detalhes em [lighthouse/README.md](lighthouse/README.md)).
