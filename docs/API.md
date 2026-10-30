# Contratos REST e eventos em tempo real

Fonte única dos contratos: [`src/api/contracts.ts`](../src/api/contracts.ts) (schemas **zod**). Os mesmos
schemas tipam o cliente (Axios → TanStack Query → componentes) e validam as requisições nos handlers do
MSW, de modo que transporte, estado e interface compartilham os tipos. Toda resposta recebida pelo
cliente é validada com `schema.safeParse`; uma resposta fora do contrato vira `ApiError` do tipo
`invalid-response`.

- Base: `VITE_API_BASE_URL` (padrão `/api`). JSON em UTF-8.
- Valores monetários: **inteiros em micro-ETH** (`1 ETH = 1 000 000`), para evitar erros de ponto flutuante.
- Datas: ISO 8601 (UTC).
- Autenticação: `Authorization: Bearer <token>` (token opaco de sessão). Nenhum cookie é usado
  (o cliente envia `credentials: 'omit'`).

## Cabeçalhos

| Cabeçalho | Direção | Uso |
| --- | --- | --- |
| `Authorization: Bearer <token>` | requisição | sessão do colecionador |
| `X-Cart-Id` | requisição/resposta | carrinho de visitante (`guest_…`); unido ao carrinho da conta no login |
| `Idempotency-Key` | requisição | obrigatório em `POST /api/orders` (16–80 caracteres `[A-Za-z0-9_-]`) |
| `Idempotent-Replayed: true` | resposta | o pedido devolvido já existia para aquela chave |

## Erros

Todas as falhas usam o mesmo envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Verifique os campos destacados.",
    "fieldErrors": { "email": "Informe um e-mail válido." },
    "details": {},
    "retryable": false
  }
}
```

| Código | HTTP | Quando |
| --- | --- | --- |
| `VALIDATION_ERROR` | 422 (400 para cabeçalho inválido) | corpo/parâmetros fora do contrato; `fieldErrors` por campo |
| `UNAUTHENTICATED` | 401 | sem token ou token inválido/revogado |
| `SESSION_EXPIRED` | 401 | sessão expirada (o cliente encerra a sessão e preserva o contexto) |
| `INVALID_CREDENTIALS` | 401 | e-mail ou senha incorretos |
| `FORBIDDEN` | 403 | recurso de outro usuário (pedido, carteira) |
| `NOT_FOUND` | 404 | NFT, pedido, carteira ou linha de carrinho inexistente |
| `CONFLICT` | 409 | conflito genérico (ex.: e-mail já inscrito na newsletter) |
| `EMAIL_TAKEN` / `USERNAME_TAKEN` / `ADDRESS_TAKEN` | 409 | cadastro, perfil ou carteira com dado já em uso |
| `AVAILABILITY_CONFLICT` | 409 | edição esgotada ou quantidade acima do disponível |
| `QUOTE_STALE` | 409 | preço, cupom, taxa ou rede mudaram desde a cotação; `details.quote` traz a cotação nova |
| `IDEMPOTENCY_CONFLICT` | 409 | `Idempotency-Key` reutilizada com conteúdo diferente |
| `COUPON_INVALID` / `COUPON_EXPIRED` | 422 | cupom inexistente/não aplicável ou expirado |
| `WALLET_REJECTED` | 409 | a carteira simulada recusou a conexão |
| `WALLET_NOT_CONNECTED` | 409 | carteira desconectada ou em outra rede no envio do pedido |
| `SERVICE_UNAVAILABLE` | 503 (504 em timeout) | indisponibilidade/falha transitória |
| `RATE_LIMITED` | 429 | excesso de requisições |
| `INTERNAL` | 500 | falha transitória do servidor |

`retryable` é `true` para 5xx e 429. Além das respostas HTTP, a simulação produz **falhas de conexão**
(sem resposta) e **timeouts**; o cliente as normaliza como `ApiError` dos tipos `network` e `timeout`.

## Recursos

### Sessão e conta

| Método e rota | Corpo | Resposta | Erros |
| --- | --- | --- | --- |
| `POST /api/auth/register` | `{ displayName, email, password }` | `201 { token, session }` | 422, 409 `EMAIL_TAKEN` |
| `POST /api/auth/login` | `{ email, password }` | `200 { token, session }` | 422, 401 `INVALID_CREDENTIALS` |
| `GET /api/auth/session` | — | `200 { session }` | 401 `UNAUTHENTICATED` (sem token/inválido) · 401 `SESSION_EXPIRED` |
| `POST /api/auth/logout` | — | `204` (revoga o token) | — |

`session = { user: { id, displayName, username, email, avatarUrl, bio, createdAt }, expiresAt }`.
Senha: 8–72 caracteres com maiúscula, minúscula e número. As senhas são armazenadas apenas como hash
PBKDF2-SHA-256 com sal (Web Crypto); o texto puro nunca é persistido.

### NFTs

| Método e rota | Parâmetros | Resposta |
| --- | --- | --- |
| `GET /api/nfts` | `q`, `collection` (lista separada por vírgula), `network` (idem), `minPrice`, `maxPrice` (micro-ETH), `sort` (`relevance` · `price-asc` · `price-desc` · `newest` · `popular`), `page` (1…), `pageSize` (padrão 12) | `{ items, page, pageSize, total, totalPages, facets: { collections, networks, priceRange } }` |
| `GET /api/nfts/:id` | — | `NftDetail` (galeria, edições com preço e disponibilidade, atributos, criador, `version`) · 404 |
| `GET /api/nfts/:id/related` | — | `{ items }` (mesma coleção) |

Cada NFT tem `version`, incrementada a cada mudança de preço/disponibilidade — a mesma versão que vai
nos eventos `nft.updated`.

### Favoritos (autenticado)

| Método e rota | Resposta |
| --- | --- |
| `GET /api/favorites` | `{ ids, items }` |
| `PUT /api/favorites/:nftId` | `{ ids, items }` (idempotente) |
| `DELETE /api/favorites/:nftId` | `{ ids, items }` (idempotente) |

### Carrinho (visitante via `X-Cart-Id` ou usuário autenticado)

| Método e rota | Corpo | Resposta |
| --- | --- | --- |
| `GET /api/cart` | — | `Cart` |
| `POST /api/cart/items` | `{ nftId, editionId, quantity }` (1–5) | `Cart` · 409 `AVAILABILITY_CONFLICT` |
| `PATCH /api/cart/items/:lineId` | `{ quantity }` | `Cart` · 409 |
| `DELETE /api/cart/items/:lineId` | — | `Cart` |
| `PUT /api/cart/coupon` | `{ code }` | `Cart` · 422 `COUPON_INVALID` / `COUPON_EXPIRED` |
| `DELETE /api/cart/coupon` | — | `Cart` |

`Cart = { id, owner: 'guest' | 'user', items: CartLine[], couponCode, itemCount, updatedAt, version }`.
Cada linha traz `unitPrice` (atual), `addedUnitPrice` (quando entrou no carrinho), `available` e
`nftVersion`, o que permite sinalizar mudanças de preço e disponibilidade. No login, o carrinho de
visitante é unido ao da conta (quantidades limitadas pela disponibilidade e pelo máximo por pedido).

### Cotação (autenticado)

`POST /api/quotes` com `{ network }` → `Quote`:

```text
{ quoteId, network, items[], subtotal, discount, coupon: { code, status, description } | null,
  serviceFee (2,5% sobre subtotal − desconto), networkFee (por rede), total,
  issues: [{ type: price_changed | unavailable | quantity_reduced | coupon_invalid | coupon_expired, … }],
  valid, createdAt, expiresAt (5 min) }
```

A cotação revalida preço, disponibilidade, cupom e taxas. `valid: false` impede a criação do pedido.

### Pedidos (autenticado)

| Método e rota | Corpo | Resposta |
| --- | --- | --- |
| `POST /api/orders` + `Idempotency-Key` | `{ quoteId, walletId, network, collector: { name, email, note }, acceptTerms: true }` | `201 Order` (novo) · `200 Order` + `Idempotent-Replayed: true` (mesma chave, mesmo conteúdo) |
| `GET /api/orders` | — | `{ items: OrderSummary[] }` |
| `GET /api/orders/:id` | — | `Order` (aceita id ou número `KUR-…`) · 403 · 404 |

Criação idempotente:

1. mesma chave + mesmo conteúdo → devolve **o mesmo pedido** (inclusive depois de um timeout do cliente);
2. mesma chave + conteúdo diferente → `409 IDEMPOTENCY_CONFLICT`;
3. antes de criar, o servidor revalida a cotação. Mudança de preço → `409 QUOTE_STALE`; esgotamento →
   `409 AVAILABILITY_CONFLICT`. Nos dois casos `details.quote` traz os valores novos, que exigem nova
   confirmação do usuário. Carteira desconectada ou em outra rede → `409 WALLET_NOT_CONNECTED`.

`Order.status`: `pending` → `confirmed` | `rejected` (estados terminais). O pedido é um **snapshot**:
itens, preços unitários, desconto, taxas e total são copiados da cotação no momento da criação e não
mudam com alterações posteriores do catálogo. `transaction = { hash, explorerUrl, network }` é
simulado (o link de exploração aponta para um endereço fictício).

### Perfil (autenticado)

| Método e rota | Corpo | Resposta |
| --- | --- | --- |
| `GET /api/profile` | — | `User` |
| `PATCH /api/profile` | `{ displayName, username, email, bio }` | `User` · 409 `EMAIL_TAKEN` / `USERNAME_TAKEN` |
| `PUT /api/profile/avatar` | `{ dataUrl }` (PNG, JPG ou WebP, até 2 MB; redimensionado no cliente) | `User` |
| `DELETE /api/profile/avatar` | — | `User` |
| `POST /api/profile/password` | `{ currentPassword, newPassword, confirmPassword }` | `204` · 422 (senha atual incorreta em `fieldErrors.currentPassword`) |

### Carteiras (autenticado)

| Método e rota | Corpo | Resposta |
| --- | --- | --- |
| `GET /api/wallets` | — | `{ items: Wallet[] }` |
| `POST /api/wallets` | `{ slot: primary \| secondary, name, label, provider, network, address, email?, isDefault? }` | `201 Wallet` · 409 `ADDRESS_TAKEN` / `CONFLICT` (slot ocupado) · 422 (secundária antes da principal) |
| `PATCH /api/wallets/:id` | mesmos campos, exceto `slot` | `Wallet` · 403 · 404 |
| `POST /api/wallets/:id/connection` | `{ network }` | `{ walletId, network, status: 'connected', connectedAt }` · 409 `WALLET_REJECTED` |
| `DELETE /api/wallets/:id/connection` | — | `204` |

Provedores: `metamask`, `walletconnect`, `coinbase`, `phantom`. Endereço EVM (`0x` + 40 hex) para
Ethereum/Polygon e base58 (32–44) para Solana.

### Outros

`POST /api/newsletter` `{ email }` → `204` · `409 CONFLICT` (e-mail já inscrito).

## Eventos em tempo real (Socket.IO)

Transporte: `socket.io-client` (somente WebSocket, caminho `VITE_SOCKET_PATH`, padrão `/socket.io`).
A autenticação vai no pacote de conexão (`auth: { token }`); conexões sem token recebem apenas eventos
públicos.

Envelope comum:

```text
{ id: string,            // identidade estável do evento (deduplicação)
  type: 'nft.updated' | 'order.updated',
  resource: { type: 'nft' | 'order', id: string },
  version: number,       // versão do recurso após o evento (ordenação)
  occurredAt: string,
  data: … }
```

| Evento | Destinatários | `data` |
| --- | --- | --- |
| `nft.updated` | todas as conexões | `{ nftId, name, editions: [{ id, price, available }], priceFrom, available, reason: price \| availability \| price_and_availability, previous: { priceFrom, available } }` |
| `order.updated` | somente as conexões do dono (`userId` também no envelope) | `{ orderId, number, status, failureReason, transaction }` |

Regras do cliente ([`src/realtime/client.ts`](../src/realtime/client.ts)):

- **duplicatas** (mesmo `id`) são ignoradas;
- **eventos antigos** (`version` ≤ última versão conhecida do recurso) são ignorados, sem regredir o estado
  nem repetir avisos; pedidos `confirmed`/`rejected` nunca voltam a `pending`;
- **reconexão**: os recursos ativos são reconciliados pela API REST (invalidação das queries de catálogo,
  carrinho e pedidos);
- **troca de sessão**: login, logout e troca de usuário encerram a conexão anterior e removem seus
  listeners; eventos que chegam de uma geração antiga de conexão são descartados.
