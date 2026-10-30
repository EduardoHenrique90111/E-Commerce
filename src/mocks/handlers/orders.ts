import { http, HttpResponse, delay } from 'msw'
import { HEADERS, createOrderSchema } from '@/api/contracts'
import { getConfig } from '../config'
import { stableHash, stableStringify } from '../crypto'
import { getDb, nowIso, persist } from '../db'
import { computeQuote, createOrderRecord, getOrCreateCart, orderSummaryView, orderView, revalidateQuote, updateNftEditions } from '../domain'
import { apiError, parseBody, requireAuth, simulateNetwork } from '../http'

const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{16,80}$/

export const orderHandlers = [
  /**
   * Criação idempotente de pedido.
   *  - mesma chave + mesmo conteúdo → devolve o mesmo pedido (200, Idempotent-Replayed: true)
   *  - mesma chave + conteúdo diferente → 409 IDEMPOTENCY_CONFLICT
   */
  http.post('/api/orders', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const key = request.headers.get(HEADERS.idempotencyKey)
    if (!key || !IDEMPOTENCY_KEY_RE.test(key)) {
      return apiError('VALIDATION_ERROR', 'Cabeçalho Idempotency-Key ausente ou inválido.', { status: 400 })
    }
    const parsed = await parseBody(request, createOrderSchema)
    if (!parsed.ok) return parsed.response
    const db = getDb()
    const config = getConfig()
    const requestHash = stableHash(stableStringify(parsed.data))

    const existing = db.idempotency[key]
    if (existing) {
      if (existing.userId !== auth.user.id || existing.requestHash !== requestHash) {
        return apiError('IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      }
      const order = db.orders[existing.orderId]
      return HttpResponse.json(orderView(order), { status: 200, headers: { [HEADERS.idempotentReplay]: 'true' } })
    }

    const cart = getOrCreateCart(`user:${auth.user.id}`, `cart_${auth.user.id}`)
    const quote = db.quotes[parsed.data.quoteId]
    if (!quote || quote.ownerKey !== cart.ownerKey) {
      return apiError('QUOTE_STALE', 'A cotação não é mais válida. Revise os valores atualizados.', { details: { quote: computeQuote(cart, parsed.data.network).quote } })
    }
    if (quote.network !== parsed.data.network) {
      return apiError('QUOTE_STALE', 'A rede selecionada mudou. Revise as taxas atualizadas.', { details: { quote: computeQuote(cart, parsed.data.network).quote } })
    }

    // cenários: mudança de preço ou esgotamento durante a compra (refletidos via REST e evento)
    const first = quote.lines[0]
    if (first && config.priceChangeOnOrder && !db.counters[`priceChange:${quote.quoteId}`]) {
      db.counters[`priceChange:${quote.quoteId}`] = 1
      updateNftEditions(first.nftId, [{ editionId: first.editionId, price: Math.round(first.unitPrice * 1.12) }])
    }
    if (first && config.soldOutOnOrder && !db.counters[`soldOut:${quote.quoteId}`]) {
      db.counters[`soldOut:${quote.quoteId}`] = 1
      updateNftEditions(first.nftId, [{ editionId: first.editionId, available: 0 }])
    }

    const check = revalidateQuote(quote, cart)
    if (!check.ok) {
      const fresh = computeQuote(cart, parsed.data.network).quote
      return check.reason === 'availability'
        ? apiError('AVAILABILITY_CONFLICT', 'A disponibilidade mudou. Revise o pedido antes de confirmar.', { details: { quote: fresh, issues: check.details } })
        : apiError('QUOTE_STALE', 'Os valores mudaram desde a revisão. Confirme novamente com os valores atualizados.', { details: { quote: fresh, issues: check.details } })
    }

    const wallet = db.wallets.find((w) => w.id === parsed.data.walletId)
    if (!wallet) return apiError('NOT_FOUND', 'Carteira não encontrada.', { fieldErrors: { walletId: 'Selecione uma carteira cadastrada.' } })
    if (wallet.userId !== auth.user.id) return apiError('FORBIDDEN', 'Esta carteira pertence a outra conta.')
    const connection = db.walletConnections[auth.user.id]
    if (!connection || connection.walletId !== wallet.id || connection.network !== parsed.data.network) {
      return apiError('WALLET_NOT_CONNECTED', 'Conecte a carteira selecionada na rede escolhida antes de confirmar.', { fieldErrors: { walletId: 'Carteira desconectada.' } })
    }

    const order = createOrderRecord({
      userId: auth.user.id,
      quote,
      wallet,
      network: parsed.data.network,
      collector: { name: parsed.data.collector.name, email: parsed.data.collector.email, note: parsed.data.collector.note ?? '' },
    })
    db.idempotency[key] = { key, userId: auth.user.id, requestHash, orderId: order.id, createdAt: nowIso(), delayedOnce: false }
    delete db.quotes[quote.quoteId]
    persist()

    if (config.orderTimeout && !db.idempotency[key].delayedOnce) {
      // o pedido já existe, mas a resposta chega depois do timeout do cliente
      db.idempotency[key].delayedOnce = true
      persist()
      await delay(config.orderResponseDelayMs)
    }
    return HttpResponse.json(orderView(order), { status: 201 })
  }),

  http.get('/api/orders', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const items = Object.values(getDb().orders)
      .filter((o) => o.userId === auth.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(orderSummaryView)
    return HttpResponse.json({ items })
  }),

  http.get('/api/orders/:id', async ({ request, params }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const db = getDb()
    const id = String(params.id)
    const order = db.orders[id] ?? Object.values(db.orders).find((o) => o.number.toLowerCase() === id.toLowerCase())
    if (!order) return apiError('NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== auth.user.id) return apiError('FORBIDDEN', 'Você não tem permissão para ver este pedido.')
    return HttpResponse.json(orderView(order))
  }),
]
