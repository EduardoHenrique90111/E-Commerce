import type { CatalogSort, CollectionSlug, Network, OrderStatus, WalletProvider } from '@/api/contracts'

/** Formata micro-ETH como no Figma ("1.10 ETH"). */
export function formatEth(micro: number, options: { decimals?: number; withUnit?: boolean } = {}): string {
  const { withUnit = true } = options
  const value = micro / 1_000_000
  // 2 casas por padrão; até 4 quando necessário para não perder precisão (taxas)
  let decimals = options.decimals ?? 2
  if (options.decimals === undefined) {
    while (decimals < 4 && Math.round(value * 10 ** decimals) / 10 ** decimals !== value) decimals++
  }
  const text = value.toFixed(decimals)
  return withUnit ? `${text} ETH` : text
}

/** Versão para leitores de tela (ex.: "1,10 ether"). */
export function spokenEth(micro: number): string {
  return `${(micro / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ether`
}

export function ethToMicro(eth: number): number {
  return Math.round(eth * 1_000_000)
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

export const NETWORK_LABEL: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export const COLLECTION_LABEL: Record<CollectionSlug, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  esportes: 'Esportes',
  jogos: 'Jogos',
  ilustracoes: 'Ilustrações',
}

export const SORT_LABEL: Record<CatalogSort, string> = {
  relevance: 'Relevância',
  'price-asc': 'Menor preço',
  'price-desc': 'Maior preço',
  newest: 'Mais recentes',
  popular: 'Mais vendidos',
}

export const PROVIDER_LABEL: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
  phantom: 'Phantom',
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  rejected: 'Recusado',
}

export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

/** srcset das imagens geradas (-320/-640/-960.webp). */
export function imageSrcSet(base: string): string {
  return `${base}-320.webp 320w, ${base}-640.webp 640w, ${base}-960.webp 960w`
}

export function imageSrc(base: string, size: 320 | 640 | 960 = 640): string {
  return `${base}-${size}.webp`
}
