import { http, HttpResponse } from 'msw'
import { HEADERS, addCartItemSchema, couponRequestSchema, quoteRequestSchema, updateCartItemSchema } from '@/api/contracts'
import { getDb } from '../db'
import { addLine, cartView, checkCoupon, computeQuote, getOrCreateCart, touchCart } from '../domain'
import { apiError, cartOwner, parseBody, simulateNetwork } from '../http'

/** Resolve (ou cria) o carrinho do dono da requisição. */
function resolveCart(request: Request) {
  const owner = cartOwner(request)
  if (!owner.ok) return owner
  if (owner.ownerKey) return { ok: true as const, cart: getOrCreateCart(owner.ownerKey, owner.userId ? `cart_${owner.userId}` : owner.ownerKey.slice('guest:'.length)) }
  // visitante sem carrinho: cria um novo identificador
  const id = `guest_${Math.random().toString(36).slice(2, 12)}`
  return { ok: true as const, cart: getOrCreateCart(`guest:${id}`, id) }
}

function cartResponse(request: Request) {
  const resolved = resolveCart(request)
  if (!resolved.ok) return resolved.response
  return HttpResponse.json(cartView(resolved.cart), { headers: { [HEADERS.guestCart]: resolved.cart.id } })
}

export const cartHandlers = [
  http.get('/api/cart', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    return cartResponse(request)
  }),

  http.post('/api/cart/items', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const resolved = resolveCart(request)
    if (!resolved.ok) return resolved.response
    const parsed = await parseBody(request, addCartItemSchema)
    if (!parsed.ok) return parsed.response
    const nft = getDb().nfts[parsed.data.nftId]
    const edition = nft?.editions.find((e) => e.id === parsed.data.editionId)
    if (!nft || !edition) return apiError('NOT_FOUND', 'NFT ou edição não encontrada.')
    const already = resolved.cart.lines.find((l) => l.nftId === nft.id && l.editionId === edition.id)?.quantity ?? 0
    if (edition.available === 0) {
      return apiError('AVAILABILITY_CONFLICT', `A edição ${edition.label} de ${nft.name} está esgotada.`, { details: { nftId: nft.id, editionId: edition.id, available: 0 } })
    }
    if (already + parsed.data.quantity > edition.available) {
      return apiError('AVAILABILITY_CONFLICT', `Restam apenas ${edition.available} edição(ões) disponíveis${already ? ` e você já tem ${already} no carrinho` : ''}.`, {
        details: { nftId: nft.id, editionId: edition.id, available: edition.available },
      })
    }
    addLine(resolved.cart, nft.id, edition.id, parsed.data.quantity)
    return HttpResponse.json(cartView(resolved.cart), { headers: { [HEADERS.guestCart]: resolved.cart.id } })
  }),

  http.patch('/api/cart/items/:lineId', async ({ request, params }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const resolved = resolveCart(request)
    if (!resolved.ok) return resolved.response
    const parsed = await parseBody(request, updateCartItemSchema)
    if (!parsed.ok) return parsed.response
    const line = resolved.cart.lines.find((l) => l.lineId === params.lineId)
    if (!line) return apiError('NOT_FOUND', 'Item não encontrado no carrinho.')
    const ed = getDb().nfts[line.nftId]?.editions.find((e) => e.id === line.editionId)
    if (!ed) return apiError('NOT_FOUND', 'Edição não encontrada.')
    if (parsed.data.quantity > ed.available) {
      return apiError('AVAILABILITY_CONFLICT', `Restam apenas ${ed.available} edição(ões) disponíveis.`, { details: { lineId: line.lineId, available: ed.available } })
    }
    line.quantity = parsed.data.quantity
    touchCart(resolved.cart)
    return HttpResponse.json(cartView(resolved.cart), { headers: { [HEADERS.guestCart]: resolved.cart.id } })
  }),

  http.delete('/api/cart/items/:lineId', async ({ request, params }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const resolved = resolveCart(request)
    if (!resolved.ok) return resolved.response
    const before = resolved.cart.lines.length
    resolved.cart.lines = resolved.cart.lines.filter((l) => l.lineId !== params.lineId)
    if (resolved.cart.lines.length === before) return apiError('NOT_FOUND', 'Item não encontrado no carrinho.')
    if (resolved.cart.lines.length === 0) resolved.cart.couponCode = null
    touchCart(resolved.cart)
    return HttpResponse.json(cartView(resolved.cart), { headers: { [HEADERS.guestCart]: resolved.cart.id } })
  }),

  http.put('/api/cart/coupon', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const resolved = resolveCart(request)
    if (!resolved.ok) return resolved.response
    const parsed = await parseBody(request, couponRequestSchema)
    if (!parsed.ok) return parsed.response
    const view = cartView(resolved.cart)
    const subtotal = view.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    const check = checkCoupon(parsed.data.code, subtotal)
    if (check.status === 'expired') return apiError('COUPON_EXPIRED', check.description, { fieldErrors: { code: check.description } })
    if (check.status === 'invalid') return apiError('COUPON_INVALID', check.description, { fieldErrors: { code: check.description } })
    resolved.cart.couponCode = check.code
    touchCart(resolved.cart)
    return HttpResponse.json(cartView(resolved.cart), { headers: { [HEADERS.guestCart]: resolved.cart.id } })
  }),

  http.delete('/api/cart/coupon', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const resolved = resolveCart(request)
    if (!resolved.ok) return resolved.response
    resolved.cart.couponCode = null
    touchCart(resolved.cart)
    return HttpResponse.json(cartView(resolved.cart), { headers: { [HEADERS.guestCart]: resolved.cart.id } })
  }),

  /** Cotação: revalida preço, disponibilidade, cupom e taxas do carrinho atual. */
  http.post('/api/quotes', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const resolved = resolveCart(request)
    if (!resolved.ok) return resolved.response
    const parsed = await parseBody(request, quoteRequestSchema)
    if (!parsed.ok) return parsed.response
    return HttpResponse.json(computeQuote(resolved.cart, parsed.data.network).quote)
  }),
]
