import type { CatalogSort, CollectionSlug, Network, OrderStatus, WalletProvider } from '@/api/contracts'

/**
 * Formata micro-ETH como no Figma ("1.10 ETH"): mínimo de 2 casas e até 6 (precisão total do
 * micro-ETH), calculado com inteiros para não perder centavos por arredondamento de ponto flutuante.
 */
export function formatEth(micro: number, options: { decimals?: number; withUnit?: boolean } = {}): string {
  const { withUnit = true } = options
  const negative = micro < 0
  const abs = Math.abs(Math.round(micro))
  const whole = Math.floor(abs / 1_000_000)
  let frac = String(abs % 1_000_000).padStart(6, '0')
  if (options.decimals !== undefined) {
    const factor = 10 ** (6 - options.decimals)
    const rounded = Math.round(abs / factor) * factor
    const w = Math.floor(rounded / 1_000_000)
    const f = String(rounded % 1_000_000).padStart(6, '0').slice(0, options.decimals)
    const text = `${negative ? '-' : ''}${w}${options.decimals ? `.${f}` : ''}`
    return withUnit ? `${text} ETH` : text
  }
  frac = frac.replace(/0+$/, '').padEnd(2, '0')
  const text = `${negative ? '-' : ''}${whole}.${frac}`
  return withUnit ? `${text} ETH` : text
}

/** Versão para leitores de tela (ex.: "1,10 ether"). */
const spokenFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })

/** Valor por extenso para leitores de tela (formatador reutilizado: criar Intl a cada chamada é caro). */
export function spokenEth(micro: number): string {
  return `${spokenFmt.format(micro / 1_000_000)} ether`
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
