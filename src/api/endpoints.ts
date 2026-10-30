/**
 * Funções de acesso aos recursos REST (contratos documentados em docs/API.md).
 * Cada função recebe `signal` quando usada por queries, permitindo cancelar requisições obsoletas.
 */
import { ORDER_TIMEOUT_MS, request, requestVoid } from './client'
import {
  HEADERS,
  authResponseSchema,
  cartSchema,
  catalogResponseSchema,
  favoritesResponseSchema,
  nftDetailSchema,
  orderSchema,
  ordersResponseSchema,
  quoteSchema,
  relatedResponseSchema,
  sessionResponseSchema,
  userSchema,
  walletConnectionSchema,
  walletSchema,
  walletsResponseSchema,
  type AddCartItem,
  type CatalogQuery,
  type CreateOrderRequest,
  type LoginRequest,
  type Network,
  type PasswordChange,
  type ProfileUpdate,
  type RegisterRequest,
  type WalletCreate,
  type WalletUpdate,
} from './contracts'

type Opts = { signal?: AbortSignal }

export function catalogParams(query: CatalogQuery): Record<string, string> {
  const params: Record<string, string> = {}
  if (query.q) params.q = query.q
  if (query.collections?.length) params.collection = query.collections.join(',')
  if (query.networks?.length) params.network = query.networks.join(',')
  if (query.minPrice !== undefined) params.minPrice = String(query.minPrice)
  if (query.maxPrice !== undefined) params.maxPrice = String(query.maxPrice)
  if (query.sort && query.sort !== 'relevance') params.sort = query.sort
  if (query.page && query.page > 1) params.page = String(query.page)
  if (query.pageSize) params.pageSize = String(query.pageSize)
  return params
}

export const api = {
  auth: {
    login: (body: LoginRequest) => request({ method: 'POST', url: '/auth/login', data: body }, authResponseSchema),
    register: (body: RegisterRequest) => request({ method: 'POST', url: '/auth/register', data: body }, authResponseSchema),
    session: ({ signal }: Opts = {}) => request({ method: 'GET', url: '/auth/session', signal }, sessionResponseSchema),
    logout: () => requestVoid({ method: 'POST', url: '/auth/logout', timeout: 4000 }),
  },
  nfts: {
    list: (query: CatalogQuery, { signal }: Opts = {}) =>
      request({ method: 'GET', url: '/nfts', params: catalogParams(query), signal }, catalogResponseSchema),
    detail: (id: string, { signal }: Opts = {}) => request({ method: 'GET', url: `/nfts/${encodeURIComponent(id)}`, signal }, nftDetailSchema),
    related: (id: string, { signal }: Opts = {}) =>
      request({ method: 'GET', url: `/nfts/${encodeURIComponent(id)}/related`, signal }, relatedResponseSchema),
  },
  favorites: {
    list: ({ signal }: Opts = {}) => request({ method: 'GET', url: '/favorites', signal }, favoritesResponseSchema),
    add: (nftId: string) => request({ method: 'PUT', url: `/favorites/${encodeURIComponent(nftId)}` }, favoritesResponseSchema),
    remove: (nftId: string) => request({ method: 'DELETE', url: `/favorites/${encodeURIComponent(nftId)}` }, favoritesResponseSchema),
  },
  cart: {
    get: ({ signal }: Opts = {}) => request({ method: 'GET', url: '/cart', signal }, cartSchema),
    addItem: (body: AddCartItem) => request({ method: 'POST', url: '/cart/items', data: body }, cartSchema),
    updateItem: (lineId: string, quantity: number) => request({ method: 'PATCH', url: `/cart/items/${lineId}`, data: { quantity } }, cartSchema),
    removeItem: (lineId: string) => request({ method: 'DELETE', url: `/cart/items/${lineId}` }, cartSchema),
    applyCoupon: (code: string) => request({ method: 'PUT', url: '/cart/coupon', data: { code } }, cartSchema),
    removeCoupon: () => request({ method: 'DELETE', url: '/cart/coupon' }, cartSchema),
  },
  quotes: {
    create: (network: Network, { signal }: Opts = {}) => request({ method: 'POST', url: '/quotes', data: { network }, signal }, quoteSchema),
  },
  orders: {
    create: (body: CreateOrderRequest, idempotencyKey: string) =>
      request(
        { method: 'POST', url: '/orders', data: body, headers: { [HEADERS.idempotencyKey]: idempotencyKey }, timeout: ORDER_TIMEOUT_MS },
        orderSchema,
      ),
    get: (id: string, { signal }: Opts = {}) => request({ method: 'GET', url: `/orders/${encodeURIComponent(id)}`, signal }, orderSchema),
    list: ({ signal }: Opts = {}) => request({ method: 'GET', url: '/orders', signal }, ordersResponseSchema),
  },
  profile: {
    get: ({ signal }: Opts = {}) => request({ method: 'GET', url: '/profile', signal }, userSchema),
    update: (body: ProfileUpdate) => request({ method: 'PATCH', url: '/profile', data: body }, userSchema),
    updateAvatar: (dataUrl: string) => request({ method: 'PUT', url: '/profile/avatar', data: { dataUrl } }, userSchema),
    removeAvatar: () => request({ method: 'DELETE', url: '/profile/avatar' }, userSchema),
    changePassword: (body: PasswordChange) => requestVoid({ method: 'POST', url: '/profile/password', data: body }),
  },
  wallets: {
    list: ({ signal }: Opts = {}) => request({ method: 'GET', url: '/wallets', signal }, walletsResponseSchema),
    create: (body: WalletCreate) => request({ method: 'POST', url: '/wallets', data: body }, walletSchema),
    update: (id: string, body: WalletUpdate) => request({ method: 'PATCH', url: `/wallets/${id}`, data: body }, walletSchema),
    connect: (id: string, network: Network) => request({ method: 'POST', url: `/wallets/${id}/connection`, data: { network } }, walletConnectionSchema),
    disconnect: (id: string) => requestVoid({ method: 'DELETE', url: `/wallets/${id}/connection` }),
  },
}
