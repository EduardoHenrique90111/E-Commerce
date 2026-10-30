import type { Network, Wallet } from '@/api/contracts'

/** Redes compatíveis com cada provedor de carteira (usado no pagamento e no cadastro de carteiras). */
export const NETWORKS_BY_PROVIDER: Record<Wallet['provider'], Network[]> = {
  metamask: ['ethereum', 'polygon'],
  walletconnect: ['ethereum', 'polygon', 'solana'],
  coinbase: ['ethereum', 'polygon', 'solana'],
  phantom: ['solana'],
}
