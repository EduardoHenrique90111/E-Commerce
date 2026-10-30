import type { CatalogQuery, Network } from '@/api/contracts'

/**
 * Fábrica de chaves do TanStack Query.
 * Dados privados ficam sob ['user', userId, ...] — isolados por usuário e removidos no logout.
 * O carrinho usa o dono (usuário ou visitante) na chave.
 */
export const qk = {
  session: ['session'] as const,
  nfts: ['nfts'] as const,
  catalog: (query: CatalogQuery) => ['nfts', 'list', query] as const,
  catalogAll: ['nfts', 'list'] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  nftDetails: ['nfts', 'detail'] as const,
  related: (id: string) => ['nfts', 'related', id] as const,
  cartAll: ['cart'] as const,
  cart: (owner: string) => ['cart', owner] as const,
  quote: (owner: string, network: Network, cartVersion: number) => ['cart', owner, 'quote', network, cartVersion] as const,
  user: (userId: string) => ['user', userId] as const,
  favorites: (userId: string) => ['user', userId, 'favorites'] as const,
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  wallets: (userId: string) => ['user', userId, 'wallets'] as const,
  orders: (userId: string) => ['user', userId, 'orders'] as const,
  order: (userId: string, orderId: string) => ['user', userId, 'order', orderId] as const,
  ordersAll: (userId: string) => ['user', userId, 'order'] as const,
}
