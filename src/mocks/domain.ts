/**
 * Regras de negócio do backend simulado (catálogo, carrinho, cotação, pedidos).
 * Toda mutation persiste o estado e, quando aplicável, publica o evento correspondente.
 */
import type {
  Cart,
  CatalogQuery,
  CatalogResponse,
  CollectionSlug,
  Network,
  NftDetail,
  NftSummary,
  Order,
  OrderSummary,
  Quote,
  QuoteIssue,
  Wallet,
} from '@/api/contracts'
import { CATALOG_PAGE_SIZE, COLLECTIONS, MAX_PER_ORDER, NETWORKS } from '@/api/contracts'
import { getConfig } from './config'
import { stableHash } from './crypto'
import { explorerUrl, getDb, imageBase, nowIso, persist, serialFor, type CartRecord, type NftRecord, type OrderRecord, type QuoteRecord, type WalletRecord } from './db'
import { COUPONS, NETWORK_FEES, SERVICE_FEE_BPS } from './fixtures/users'
import { makeNftUpdated, makeOrderUpdated, publish } from './events'

/* ------------------------------------------------------------------ */
/* Catálogo                                                            */
/* ------------------------------------------------------------------ */

const COLLECTION_LABEL: Record<CollectionSlug, string> = {
  'arte-digital': 'arte digital',
  fotografia: 'fotografia',
  musica: 'música',
  'arte-3d': 'arte 3d',
  colecionaveis: 'colecionáveis',
  esportes: 'esportes',
  jogos: 'jogos',
  ilustracoes: 'ilustrações',
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export function priceFrom(nft: NftRecord): number {
  const purchasable = nft.editions.filter((e) => e.available > 0)
  const pool = purchasable.length ? purchasable : nft.editions
  return Math.min(...pool.map((e) => e.price))
}

export function totalAvailable(nft: NftRecord): number {
  return nft.editions.reduce((s, e) => s + e.available, 0)
}

export function altText(nft: NftRecord): string {
  return `Retrato ilustrado de ${nft.name}: ${nft.attributes.join(', ').toLowerCase() || 'personagem da coleção'}.`
}

export function toSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    name: nft.name,
    collection: nft.collection,
    network: nft.network,
    creator: nft.creator,
    image: { base: imageBase(nft.id), alt: altText(nft) },
    priceFrom: priceFrom(nft),
    available: totalAvailable(nft),
    badge: nft.badge,
    rating: nft.rating,
    reviewsCount: nft.reviewsCount,
    version: nft.version,
  }
}

export function toDetail(nft: NftRecord): NftDetail {
  const summary = toSummary(nft)
  const siblings = Object.values(getDb().nfts)
    .filter((n) => n.collection === nft.collection && n.id !== nft.id)
    .slice(0, 3)
  return {
    ...summary,
    description: nft.description,
    attributes: nft.attributes,
    rarity: nft.rarity,
    serial: serialFor(nft.id, nft.editions[0].id),
    createdAt: nft.createdAt,
    sales: nft.sales,
    editions: nft.editions.map((e) => ({ ...e })),
    gallery: [
      summary.image,
      ...siblings.map((s) => ({ base: imageBase(s.id), alt: `Variação da coleção: ${s.name}` })),
    ],
    maxPerOrder: MAX_PER_ORDER,
  }
}

function matchesQuery(nft: NftRecord, q: string): boolean {
  if (!q) return true
  const hay = normalize(
    [nft.name, nft.creator.name, nft.creator.handle, COLLECTION_LABEL[nft.collection], nft.network, ...nft.attributes].join(' '),
  )
  return normalize(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term))
}

export function listCatalog(query: CatalogQuery): CatalogResponse {
  const config = getConfig()
  const all = config.emptyCatalog ? [] : Object.values(getDb().nfts)
  const q = query.q?.trim() ?? ''
  const inPrice = (n: NftRecord) => {
    const p = priceFrom(n)
    return (query.minPrice === undefined || p >= query.minPrice) && (query.maxPrice === undefined || p <= query.maxPrice)
  }
  const inCollections = (n: NftRecord) => !query.collections?.length || query.collections.includes(n.collection)
  const inNetworks = (n: NftRecord) => !query.networks?.length || query.networks.includes(n.network)

  const base = all.filter((n) => matchesQuery(n, q) && inPrice(n))
  const filtered = base.filter((n) => inCollections(n) && inNetworks(n))

  const sort = query.sort ?? 'relevance'
  const score = (n: NftRecord) => (n.featured ? 1000 : 0) + n.sales * n.rating + (q && normalize(n.name).includes(normalize(q)) ? 5000 : 0)
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'price-asc':
        return priceFrom(a) - priceFrom(b) || a.id.localeCompare(b.id)
      case 'price-desc':
        return priceFrom(b) - priceFrom(a) || a.id.localeCompare(b.id)
      case 'newest':
        return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
      case 'popular':
        return b.sales - a.sales || a.id.localeCompare(b.id)
      default:
        return score(b) - score(a) || a.id.localeCompare(b.id)
    }
  })

  const pageSize = Math.min(Math.max(query.pageSize ?? CATALOG_PAGE_SIZE, 1), 48)
  const totalPages = Math.ceil(sorted.length / pageSize)
  const page = Math.max(1, query.page ?? 1)
  const items = sorted.slice((page - 1) * pageSize, page * pageSize).map(toSummary)

  const prices = all.map(priceFrom)
  return {
    items,
    page,
    pageSize,
    total: sorted.length,
    totalPages,
    facets: {
      collections: COLLECTIONS.map((c) => ({ value: c, count: base.filter((n) => n.collection === c && inNetworks(n)).length })),
      networks: NETWORKS.map((nw) => ({ value: nw, count: base.filter((n) => n.network === nw && inCollections(n)).length })),
      priceRange: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
    },
  }
}

export function relatedNfts(nftId: string): NftSummary[] {
  const db = getDb()
  const nft = db.nfts[nftId]
  if (!nft) return []
  const same = Object.values(db.nfts).filter((n) => n.collection === nft.collection && n.id !== nftId)
  const others = Object.values(db.nfts).filter((n) => n.collection !== nft.collection && n.id !== nftId)
  return [...same, ...others].slice(0, 5).map(toSummary)
}

/**
 * Altera preço e/ou disponibilidade de edições. Incrementa a versão do NFT e publica `nft.updated`
 * — a mesma mudança fica visível na API REST e nos eventos.
 */
export function updateNftEditions(
  nftId: string,
  changes: Array<{ editionId: string; price?: number; available?: number }>,
): NftRecord | null {
  const db = getDb()
  const nft = db.nfts[nftId]
  if (!nft) return null
  const previous = { priceFrom: priceFrom(nft), available: totalAvailable(nft) }
  let priceChanged = false
  let availabilityChanged = false
  for (const c of changes) {
    const ed = nft.editions.find((e) => e.id === c.editionId)
    if (!ed) continue
    if (c.price !== undefined && c.price !== ed.price) {
      ed.price = Math.max(1, Math.round(c.price))
      priceChanged = true
    }
    if (c.available !== undefined && c.available !== ed.available) {
      ed.available = Math.max(0, Math.min(ed.supply, Math.round(c.available)))
      availabilityChanged = true
    }
  }
  if (!priceChanged && !availabilityChanged) return nft
  nft.version += 1
  persist()
  publish(
    makeNftUpdated(
      {
        nftId: nft.id,
        name: nft.name,
        editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })),
        priceFrom: priceFrom(nft),
        available: totalAvailable(nft),
        reason: priceChanged && availabilityChanged ? 'price_and_availability' : priceChanged ? 'price' : 'availability',
        previous,
      },
      nft.version,
    ),
  )
  return nft
}

/* ------------------------------------------------------------------ */
/* Carrinho                                                            */
/* ------------------------------------------------------------------ */

export function getOrCreateCart(ownerKey: string, preferredId?: string): CartRecord {
  const db = getDb()
  let cart = db.carts[ownerKey]
  if (!cart) {
    cart = { id: preferredId ?? `cart_${Math.random().toString(36).slice(2, 10)}`, ownerKey, lines: [], couponCode: null, updatedAt: nowIso(), version: 1 }
    db.carts[ownerKey] = cart
    persist()
  }
  return cart
}

export function touchCart(cart: CartRecord): void {
  cart.updatedAt = nowIso()
  cart.version += 1
  persist()
}

export function cartView(cart: CartRecord): Cart {
  const db = getDb()
  const items = cart.lines
    .filter((l) => db.nfts[l.nftId])
    .map((l) => {
      const nft = db.nfts[l.nftId]
      const ed = nft.editions.find((e) => e.id === l.editionId) ?? nft.editions[0]
      return {
        lineId: l.lineId,
        nftId: l.nftId,
        editionId: ed.id,
        name: nft.name,
        editionLabel: ed.label,
        image: { base: imageBase(nft.id), alt: altText(nft) },
        quantity: l.quantity,
        unitPrice: ed.price,
        addedUnitPrice: l.addedUnitPrice,
        available: ed.available,
        maxPerOrder: MAX_PER_ORDER,
        nftVersion: nft.version,
      }
    })
  return {
    id: cart.id,
    owner: cart.ownerKey.startsWith('user:') ? 'user' : 'guest',
    items,
    couponCode: cart.couponCode,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    updatedAt: cart.updatedAt,
    version: cart.version,
  }
}

export function addLine(cart: CartRecord, nftId: string, editionId: string, quantity: number): void {
  const db = getDb()
  const nft = db.nfts[nftId]
  const ed = nft.editions.find((e) => e.id === editionId)!
  const existing = cart.lines.find((l) => l.nftId === nftId && l.editionId === editionId)
  if (existing) {
    existing.quantity = Math.min(MAX_PER_ORDER, ed.available, existing.quantity + quantity)
  } else {
    cart.lines.push({ lineId: `ln_${++db.seq.line}`, nftId, editionId, quantity: Math.min(quantity, ed.available, MAX_PER_ORDER), addedUnitPrice: ed.price })
  }
  touchCart(cart)
}

/** Une o carrinho de visitante ao carrinho do usuário (após login/cadastro). */
export function mergeGuestCart(guestId: string | null, userId: string): void {
  if (!guestId) return
  const db = getDb()
  const guest = db.carts[`guest:${guestId}`]
  if (!guest || guest.lines.length === 0) return
  const userCart = getOrCreateCart(`user:${userId}`)
  for (const line of guest.lines) {
    const nft = db.nfts[line.nftId]
    if (!nft) continue
    const ed = nft.editions.find((e) => e.id === line.editionId)
    if (!ed || ed.available === 0) continue
    addLine(userCart, line.nftId, line.editionId, line.quantity)
  }
  if (!userCart.couponCode && guest.couponCode) userCart.couponCode = guest.couponCode
  delete db.carts[`guest:${guestId}`]
  touchCart(userCart)
}

/* ------------------------------------------------------------------ */
/* Cupons e cotação                                                    */
/* ------------------------------------------------------------------ */

export type CouponCheck =
  | { status: 'applied'; code: string; description: string; discount: number }
  | { status: 'invalid' | 'expired'; code: string; description: string; discount: 0 }

export function checkCoupon(code: string, subtotal: number): CouponCheck {
  const coupon = COUPONS.find((c) => c.code === code.toUpperCase())
  if (!coupon) return { status: 'invalid', code, description: 'Cupom inválido.', discount: 0 }
  if (Date.parse(coupon.validUntil) < Date.now()) return { status: 'expired', code: coupon.code, description: 'Este cupom expirou.', discount: 0 }
  if (subtotal < coupon.minSubtotal) {
    return { status: 'invalid', code: coupon.code, description: `Subtotal mínimo de ${(coupon.minSubtotal / 1_000_000).toFixed(2)} ETH para este cupom.`, discount: 0 }
  }
  const discount = coupon.kind === 'percent' ? Math.round((subtotal * coupon.value) / 100) : Math.min(coupon.value, subtotal)
  return { status: 'applied', code: coupon.code, description: coupon.description, discount }
}

const QUOTE_TTL_MS = 5 * 60 * 1000

export function computeQuote(cart: CartRecord, network: Network): { quote: Quote; record: QuoteRecord } {
  const db = getDb()
  const view = cartView(cart)
  const issues: QuoteIssue[] = []
  const lines = view.items.map((item) => {
    const quantity = Math.min(item.quantity, item.available)
    if (item.available === 0) {
      issues.push({ type: 'unavailable', lineId: item.lineId, nftId: item.nftId, message: `${item.name} (${item.editionLabel}) esgotou.` })
    } else if (quantity < item.quantity) {
      issues.push({
        type: 'quantity_reduced',
        lineId: item.lineId,
        nftId: item.nftId,
        message: `Restam apenas ${item.available} edição(ões) de ${item.name}.`,
        previous: item.quantity,
        current: quantity,
      })
    }
    if (item.unitPrice !== item.addedUnitPrice) {
      issues.push({
        type: 'price_changed',
        lineId: item.lineId,
        nftId: item.nftId,
        message: `O preço de ${item.name} mudou desde que você o adicionou.`,
        previous: item.addedUnitPrice,
        current: item.unitPrice,
      })
    }
    return {
      lineId: item.lineId,
      nftId: item.nftId,
      editionId: item.editionId,
      name: item.name,
      editionLabel: item.editionLabel,
      image: item.image,
      quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * quantity,
      nftVersion: item.nftVersion,
      available: item.available,
    }
  })
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  let coupon: Quote['coupon'] = null
  let discount = 0
  if (cart.couponCode) {
    const check = checkCoupon(cart.couponCode, subtotal)
    coupon = { code: check.code, status: check.status, description: check.description }
    discount = check.discount
    if (check.status !== 'applied') issues.push({ type: check.status === 'expired' ? 'coupon_expired' : 'coupon_invalid', message: check.description })
  }
  const purchasable = lines.filter((l) => l.quantity > 0)
  const serviceFee = Math.round(((subtotal - discount) * SERVICE_FEE_BPS) / 10_000)
  const networkFee = purchasable.length ? NETWORK_FEES[network] : 0
  const total = subtotal - discount + serviceFee + networkFee
  const blocking = issues.some((i) => i.type === 'unavailable' || i.type === 'quantity_reduced' || i.type === 'coupon_expired' || i.type === 'coupon_invalid')
  db.seq.quote += 1
  const createdAt = nowIso()
  const record: QuoteRecord = {
    quoteId: `qt_${String(db.seq.quote).padStart(5, '0')}_${stableHash(cart.id + createdAt).slice(0, 6)}`,
    ownerKey: cart.ownerKey,
    network,
    lines: purchasable.map((l) => ({ lineId: l.lineId, nftId: l.nftId, editionId: l.editionId, quantity: l.quantity, unitPrice: l.unitPrice, nftVersion: l.nftVersion })),
    couponCode: coupon?.status === 'applied' ? coupon.code : null,
    subtotal,
    discount,
    serviceFee,
    networkFee,
    total,
    createdAt,
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
  }
  // mantém apenas as cotações recentes por dono
  for (const [id, q] of Object.entries(db.quotes)) {
    if (q.ownerKey === cart.ownerKey && Date.parse(q.expiresAt) < Date.now()) delete db.quotes[id]
  }
  db.quotes[record.quoteId] = record
  persist()
  return {
    record,
    quote: {
      quoteId: record.quoteId,
      network,
      items: lines,
      subtotal,
      discount,
      coupon,
      serviceFee,
      networkFee,
      total,
      issues,
      valid: purchasable.length > 0 && !blocking,
      createdAt,
      expiresAt: record.expiresAt,
    },
  }
}

/** Compara a cotação enviada com o estado atual (preço, disponibilidade, cupom, carrinho). */
export function revalidateQuote(record: QuoteRecord, cart: CartRecord): { ok: true } | { ok: false; reason: 'stale' | 'availability'; details: QuoteIssue[] } {
  if (Date.parse(record.expiresAt) < Date.now()) return { ok: false, reason: 'stale', details: [{ type: 'price_changed', message: 'A cotação expirou.' }] }
  const db = getDb()
  const issues: QuoteIssue[] = []
  let availability = false
  for (const line of record.lines) {
    const nft = db.nfts[line.nftId]
    const ed = nft?.editions.find((e) => e.id === line.editionId)
    const cartLine = cart.lines.find((l) => l.lineId === line.lineId)
    if (!nft || !ed || !cartLine) {
      issues.push({ type: 'unavailable', lineId: line.lineId, nftId: line.nftId, message: 'Um item da cotação não está mais no carrinho.' })
      continue
    }
    if (ed.available < line.quantity) {
      availability = true
      issues.push({
        type: ed.available === 0 ? 'unavailable' : 'quantity_reduced',
        lineId: line.lineId,
        nftId: line.nftId,
        message: ed.available === 0 ? `${nft.name} (${ed.label}) esgotou.` : `Restam apenas ${ed.available} edição(ões) de ${nft.name}.`,
        previous: line.quantity,
        current: ed.available,
      })
    }
    if (ed.price !== line.unitPrice) {
      issues.push({ type: 'price_changed', lineId: line.lineId, nftId: line.nftId, message: `O preço de ${nft.name} mudou.`, previous: line.unitPrice, current: ed.price })
    }
    if (cartLine.quantity !== line.quantity) {
      issues.push({ type: 'quantity_reduced', lineId: line.lineId, nftId: line.nftId, message: 'A quantidade no carrinho mudou desde a cotação.', previous: line.quantity, current: cartLine.quantity })
    }
  }
  const quotedLineIds = new Set(record.lines.map((l) => l.lineId))
  if (cart.lines.some((l) => !quotedLineIds.has(l.lineId) && (db.nfts[l.nftId]?.editions.find((e) => e.id === l.editionId)?.available ?? 0) > 0)) {
    issues.push({ type: 'price_changed', message: 'Novos itens foram adicionados ao carrinho depois da cotação.' })
  }
  if (record.couponCode) {
    const check = checkCoupon(record.couponCode, record.subtotal)
    if (check.status !== 'applied') issues.push({ type: check.status === 'expired' ? 'coupon_expired' : 'coupon_invalid', message: check.description })
  }
  if ((cart.couponCode ?? null) !== (record.couponCode ?? null)) {
    issues.push({ type: 'coupon_invalid', message: 'O cupom aplicado mudou desde a cotação.' })
  }
  if (issues.length === 0) return { ok: true }
  return { ok: false, reason: availability ? 'availability' : 'stale', details: issues }
}

/* ------------------------------------------------------------------ */
/* Carteiras                                                           */
/* ------------------------------------------------------------------ */

export function walletView(w: WalletRecord): Wallet {
  return {
    id: w.id,
    slot: w.slot,
    name: w.name,
    label: w.label,
    provider: w.provider,
    network: w.network,
    address: w.address,
    email: w.email,
    isDefault: w.isDefault,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

export function orderView(o: OrderRecord): Order {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    version: o.version,
    userId: o.userId,
    quoteId: o.quoteId,
    network: o.network,
    wallet: o.wallet,
    collector: o.collector,
    items: o.items.map((i) => ({
      nftId: i.nftId,
      editionId: i.editionId,
      name: i.name,
      editionLabel: i.editionLabel,
      image: { base: i.imageBase, alt: `Miniatura de ${i.name}` },
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      serial: i.serial,
    })),
    subtotal: o.subtotal,
    discount: o.discount,
    couponCode: o.couponCode,
    serviceFee: o.serviceFee,
    networkFee: o.networkFee,
    total: o.total,
    transaction: o.transaction,
    failureReason: o.failureReason,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    settledAt: o.settledAt,
  }
}

export function orderSummaryView(o: OrderRecord): OrderSummary {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    version: o.version,
    total: o.total,
    createdAt: o.createdAt,
    network: o.network,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
  }
}

export function createOrderRecord(input: {
  userId: string
  quote: QuoteRecord
  wallet: WalletRecord
  network: Network
  collector: { name: string; email: string; note: string }
}): OrderRecord {
  const db = getDb()
  const config = getConfig()
  const number = `KUR-${++db.seq.order}`
  const now = Date.now()
  const items = input.quote.lines.map((l) => {
    const nft = db.nfts[l.nftId]
    const ed = nft.editions.find((e) => e.id === l.editionId)!
    return {
      nftId: l.nftId,
      editionId: l.editionId,
      name: nft.name,
      editionLabel: ed.label,
      imageBase: imageBase(nft.id),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.unitPrice * l.quantity,
      serial: serialFor(nft.id, ed.id),
    }
  })
  const outcome = config.payment.outcome
  const order: OrderRecord = {
    id: `ord_${number.toLowerCase().replace('-', '')}`,
    number,
    status: 'pending',
    version: 1,
    userId: input.userId,
    quoteId: input.quote.quoteId,
    network: input.network,
    wallet: { id: input.wallet.id, label: input.wallet.label, address: input.wallet.address, provider: input.wallet.provider },
    collector: input.collector,
    items,
    subtotal: input.quote.subtotal,
    discount: input.quote.discount,
    couponCode: input.quote.couponCode,
    serviceFee: input.quote.serviceFee,
    networkFee: input.quote.networkFee,
    total: input.quote.total,
    transaction: null,
    failureReason: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    settledAt: null,
    plannedOutcome: outcome,
    settleAt: outcome === 'manual' ? null : new Date(now + config.payment.settleDelayMs).toISOString(),
    cartLines: input.quote.lines.map((l) => ({ lineId: l.lineId, nftId: l.nftId, editionId: l.editionId, quantity: l.quantity })),
  }
  db.orders[order.id] = order
  persist()
  scheduleSettlement(order)
  return order
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function scheduleSettlement(order: OrderRecord): void {
  if (order.status !== 'pending' || !order.settleAt) return
  const existing = timers.get(order.id)
  if (existing) clearTimeout(existing)
  const wait = Math.max(0, Date.parse(order.settleAt) - Date.now())
  timers.set(
    order.id,
    setTimeout(() => {
      timers.delete(order.id)
      settleOrder(order.id, order.plannedOutcome === 'rejected' ? 'rejected' : 'confirmed')
    }, wait),
  )
}

/** Reagenda liquidações pendentes após refresh (o estado vem do localStorage). */
export function resumePendingOrders(): void {
  for (const t of timers.values()) clearTimeout(t)
  timers.clear()
  for (const order of Object.values(getDb().orders)) scheduleSettlement(order)
}

/**
 * Liquida um pedido pendente. Confirmados e recusados são terminais.
 * Confirmação: baixa estoque (publica `nft.updated`) e remove do carrinho apenas o que foi comprado.
 */
export function settleOrder(orderId: string, outcome: 'confirmed' | 'rejected', reason?: string): OrderRecord | null {
  const db = getDb()
  const order = db.orders[orderId]
  if (!order || order.status !== 'pending') return order ?? null
  const now = nowIso()
  let finalOutcome = outcome
  let failureReason: string | null = null

  if (outcome === 'confirmed') {
    for (const item of order.items) {
      const ed = db.nfts[item.nftId]?.editions.find((e) => e.id === item.editionId)
      if (!ed || ed.available < item.quantity) {
        finalOutcome = 'rejected'
        failureReason = `A edição ${item.editionLabel} de ${item.name} esgotou antes da confirmação. Nenhum valor foi cobrado.`
        break
      }
    }
  } else {
    failureReason = reason ?? 'A carteira recusou a assinatura da transação (simulação). Nenhum valor foi cobrado.'
  }

  order.status = finalOutcome
  order.version += 1
  order.updatedAt = now
  order.settledAt = now
  order.settleAt = null
  order.failureReason = failureReason

  if (finalOutcome === 'confirmed') {
    const hash = `0x${stableHash(order.id + order.createdAt)}${stableHash(order.number + order.total)}${stableHash(order.userId + order.quoteId)}${stableHash(order.wallet.address)}`.slice(0, 66)
    order.transaction = { hash, explorerUrl: explorerUrl(order.network, hash), network: order.network }
    // remove do carrinho apenas as quantidades compradas
    const cart = db.carts[`user:${order.userId}`]
    if (cart) {
      for (const bought of order.cartLines) {
        const line = cart.lines.find((l) => l.lineId === bought.lineId) ?? cart.lines.find((l) => l.nftId === bought.nftId && l.editionId === bought.editionId)
        if (!line) continue
        line.quantity -= bought.quantity
      }
      cart.lines = cart.lines.filter((l) => l.quantity > 0)
      if (order.couponCode && cart.couponCode === order.couponCode) cart.couponCode = null
      touchCart(cart)
    }
    persist()
    for (const item of order.items) {
      const nft = db.nfts[item.nftId]
      const ed = nft.editions.find((e) => e.id === item.editionId)!
      nft.sales += item.quantity
      updateNftEditions(item.nftId, [{ editionId: item.editionId, available: ed.available - item.quantity }])
    }
  } else {
    persist()
  }

  publish(
    makeOrderUpdated(
      order.userId,
      { orderId: order.id, number: order.number, status: order.status, failureReason: order.failureReason, transaction: order.transaction },
      order.version,
    ),
  )
  return order
}
