/**
 * Estado do backend simulado.
 *
 * Um único objeto em memória mantém catálogo, contas, sessões, carrinhos, favoritos, carteiras,
 * cotações, pedidos e chaves de idempotência — garantindo consistência entre REST e eventos.
 * O estado é persistido em localStorage (sobrevive a refresh) e `resetDb()` restaura o seed
 * determinístico do cenário ativo.
 */
import type { CollectionSlug, Edition, Network, OrderStatus, WalletProvider } from '@/api/contracts'
import catalog from './fixtures/catalog.json'
import { SEED_USERS } from './fixtures/users'
import type { PasswordHash } from './crypto'

export const DB_KEY = 'kurio:mock:db'
export const DB_SCHEMA_VERSION = 3

export interface NftArt {
  species: string
  bg: string
  outfit: string
  outfitColor: string
  headwear: string
  eyes: string
  mouth: string
  accessory: string
}

export interface NftRecord {
  id: string
  name: string
  collection: CollectionSlug
  network: Network
  creator: { name: string; handle: string }
  art: NftArt
  attributes: string[]
  rarity: string
  description: string
  createdAt: string
  sales: number
  rating: number
  reviewsCount: number
  badge: 'novo' | 'hot' | null
  featured: boolean
  editions: Edition[]
  version: number
}

export interface UserRecord {
  id: string
  displayName: string
  username: string
  email: string
  avatarUrl: string | null
  bio: string
  createdAt: string
  password: PasswordHash
}

export interface SessionRecord {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
}

export interface CartLineRecord {
  lineId: string
  nftId: string
  editionId: string
  quantity: number
  addedUnitPrice: number
}

export interface CartRecord {
  id: string
  ownerKey: string
  lines: CartLineRecord[]
  couponCode: string | null
  updatedAt: string
  version: number
}

export interface WalletRecord {
  id: string
  userId: string
  slot: 'primary' | 'secondary'
  name: string
  label: string
  provider: WalletProvider
  network: Network
  address: string
  email: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface WalletConnectionRecord {
  walletId: string
  network: Network
  connectedAt: string
}

export interface QuoteRecord {
  quoteId: string
  ownerKey: string
  network: Network
  lines: Array<{ lineId: string; nftId: string; editionId: string; quantity: number; unitPrice: number; nftVersion: number }>
  couponCode: string | null
  subtotal: number
  discount: number
  serviceFee: number
  networkFee: number
  total: number
  createdAt: string
  expiresAt: string
}

export interface OrderRecord {
  id: string
  number: string
  status: OrderStatus
  version: number
  userId: string
  quoteId: string
  network: Network
  wallet: { id: string; label: string; address: string; provider: WalletProvider }
  collector: { name: string; email: string; note: string }
  items: Array<{
    nftId: string
    editionId: string
    name: string
    editionLabel: string
    imageBase: string
    quantity: number
    unitPrice: number
    lineTotal: number
    serial: string
  }>
  subtotal: number
  discount: number
  couponCode: string | null
  serviceFee: number
  networkFee: number
  total: number
  transaction: { hash: string; explorerUrl: string; network: Network } | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
  settledAt: string | null
  /** Planejamento da simulação. */
  plannedOutcome: 'confirmed' | 'rejected' | 'manual'
  settleAt: string | null
  /** Linhas do carrinho de origem (para remover apenas o que foi comprado). */
  cartLines: Array<{ lineId: string; nftId: string; editionId: string; quantity: number }>
}

export interface IdempotencyRecord {
  key: string
  userId: string
  requestHash: string
  orderId: string
  createdAt: string
  /** O primeiro atendimento já simulou o timeout? */
  delayedOnce: boolean
}

export interface DbState {
  schemaVersion: number
  seq: { order: number; event: number; line: number; wallet: number; user: number; quote: number }
  nfts: Record<string, NftRecord>
  users: Record<string, UserRecord>
  sessions: Record<string, SessionRecord>
  carts: Record<string, CartRecord>
  favorites: Record<string, string[]>
  wallets: WalletRecord[]
  walletConnections: Record<string, WalletConnectionRecord | null>
  quotes: Record<string, QuoteRecord>
  orders: Record<string, OrderRecord>
  idempotency: Record<string, IdempotencyRecord>
  /** Contador de tentativas por cenário (ex.: recusas de carteira restantes). */
  counters: Record<string, number>
}

const SEED_NOW = Date.parse('2026-10-29T12:00:00.000Z')

export function imageBase(nftId: string): string {
  return `/images/nfts/${nftId}`
}

export function serialFor(nftId: string, editionId: string): string {
  const n = nftId.split('-').pop() ?? '000'
  return `KUR-${n}-${editionId.slice(0, 3).toUpperCase()}`
}

function createSeed(): DbState {
  const nfts: Record<string, NftRecord> = {}
  for (const raw of catalog as Array<Omit<NftRecord, 'version'>>) {
    nfts[raw.id] = { ...raw, editions: raw.editions.map((e) => ({ ...e })), version: 1 }
  }
  const state: DbState = {
    schemaVersion: DB_SCHEMA_VERSION,
    seq: { order: 1001, event: 0, line: 0, wallet: 0, user: 0, quote: 0 },
    nfts,
    users: {},
    sessions: {},
    carts: {},
    favorites: {},
    wallets: [],
    walletConnections: {},
    quotes: {},
    orders: {},
    idempotency: {},
    counters: {},
  }

  for (const u of SEED_USERS) {
    state.users[u.id] = {
      id: u.id,
      displayName: u.displayName,
      username: u.username,
      email: u.email,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      createdAt: u.createdAt,
      password: u.password,
    }
    state.favorites[u.id] = [...u.favorites]
    const ownerKey = `user:${u.id}`
    state.carts[ownerKey] = {
      id: `cart_${u.id}`,
      ownerKey,
      couponCode: null,
      updatedAt: new Date(SEED_NOW).toISOString(),
      version: 1,
      lines: u.cart.map((l) => ({
        lineId: `ln_${++state.seq.line}`,
        nftId: l.nftId,
        editionId: l.editionId,
        quantity: l.quantity,
        addedUnitPrice: nfts[l.nftId].editions.find((e) => e.id === l.editionId)!.price,
      })),
    }
    for (const w of u.wallets) {
      state.wallets.push({
        id: `wal_${++state.seq.wallet}`,
        userId: u.id,
        ...w,
        createdAt: u.createdAt,
        updatedAt: u.createdAt,
      })
    }
    state.walletConnections[u.id] = null
    for (const o of u.orders) {
      const wallet = state.wallets.find((w) => w.userId === u.id && w.slot === 'primary')!
      const createdAt = new Date(SEED_NOW - o.daysAgo * 86_400_000).toISOString()
      const items = o.items.map((it) => {
        const nft = nfts[it.nftId]
        const ed = nft.editions.find((e) => e.id === it.editionId)!
        return {
          nftId: nft.id,
          editionId: ed.id,
          name: nft.name,
          editionLabel: ed.label,
          imageBase: imageBase(nft.id),
          quantity: it.quantity,
          unitPrice: ed.price,
          lineTotal: ed.price * it.quantity,
          serial: serialFor(nft.id, ed.id),
        }
      })
      const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
      const discount = o.couponCode === 'KURIO10' ? Math.round(subtotal * 0.1) : 0
      const serviceFee = Math.round(((subtotal - discount) * 250) / 10_000)
      const networkFee = o.network === 'ethereum' ? 12_000 : o.network === 'polygon' ? 2_000 : 1_000
      const id = `ord_${o.number.toLowerCase().replace('-', '')}`
      const hash = `0x${o.number.replace(/\D/g, '').padStart(8, '0')}${'ab12cd34ef56'.repeat(5).slice(0, 56)}`
      state.orders[id] = {
        id,
        number: o.number,
        status: 'confirmed',
        version: 2,
        userId: u.id,
        quoteId: `qt_seed_${o.number}`,
        network: o.network,
        wallet: { id: wallet.id, label: wallet.label, address: wallet.address, provider: wallet.provider },
        collector: { name: u.displayName, email: u.email, note: '' },
        items,
        subtotal,
        discount,
        couponCode: o.couponCode,
        serviceFee,
        networkFee,
        total: subtotal - discount + serviceFee + networkFee,
        transaction: { hash, explorerUrl: explorerUrl(o.network, hash), network: o.network },
        failureReason: null,
        createdAt,
        updatedAt: createdAt,
        settledAt: createdAt,
        plannedOutcome: 'confirmed',
        settleAt: null,
        cartLines: [],
      }
    }
  }
  return state
}

export function explorerUrl(network: Network, hash: string): string {
  // Domínio reservado (.example) — links simulados, nunca apontam para uma blockchain real.
  return `https://explorer.kurio.example/${network}/tx/${hash}`
}

let db: DbState = createSeed()
const listeners = new Set<() => void>()

export function getDb(): DbState {
  return db
}

export function loadDb(): void {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schemaVersion === DB_SCHEMA_VERSION) {
        db = parsed
        return
      }
    }
  } catch {
    /* estado corrompido → seed */
  }
  db = createSeed()
  persist()
}

let persistScheduled = false
export function persist(): void {
  // gravação síncrona: refresh imediatamente após uma mutation não perde dados
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    /* quota cheia ou indisponível */
  }
  if (!persistScheduled) {
    persistScheduled = true
    queueMicrotask(() => {
      persistScheduled = false
      for (const l of listeners) l()
    })
  }
}

export function onDbChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Restaura integralmente o seed (mesmo conteúdo, mesmos IDs). */
export function resetDb(): void {
  db = createSeed()
  persist()
}

/** Sincroniza alterações feitas por outra aba (evento `storage`). */
export function reloadDbFromStorage(): void {
  loadDb()
  for (const l of listeners) l()
}

export function nowIso(): string {
  return new Date().toISOString()
}
