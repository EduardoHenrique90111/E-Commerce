import type { Network, WalletProvider } from '@/api/contracts'
import type { PasswordHash } from '../crypto'

/**
 * Usuários fictícios de demonstração. As senhas abaixo são documentadas no README
 * e só existem aqui como hash PBKDF2 (o texto puro nunca é persistido).
 *
 *  - ana@kurio.dev   / Kurio@123  (carteiras principal e secundária, carrinho e pedido confirmado)
 *  - bruno@kurio.dev / Kurio@456  (carteira principal, pedido KUR-1001)
 *  - carla@kurio.dev / Kurio@789  (conta sem carteiras)
 */
export interface SeedUser {
  id: string
  displayName: string
  username: string
  email: string
  avatarUrl: string | null
  bio: string
  createdAt: string
  password: PasswordHash
  favorites: string[]
  cart: Array<{ nftId: string; editionId: string; quantity: number }>
  wallets: Array<{
    slot: 'primary' | 'secondary'
    name: string
    label: string
    provider: WalletProvider
    network: Network
    address: string
    email: string | null
    isDefault: boolean
  }>
  orders: Array<{ number: string; items: Array<{ nftId: string; editionId: string; quantity: number }>; network: Network; couponCode: string | null; daysAgo: number }>
}

export const SEED_USERS: SeedUser[] = [
  {
    id: 'usr_ana',
    displayName: 'Ana Colecionadora',
    username: 'anacoleciona',
    email: 'ana@kurio.dev',
    avatarUrl: '/images/avatars/ana-192.webp',
    bio: 'Coleciono retratos digitais e arte generativa desde 2021.',
    createdAt: '2025-03-14T12:00:00.000Z',
    password: {
      algorithm: 'pbkdf2-sha256',
      iterations: 100_000,
      salt: '0a1b2c3d4e5f60718293a4b5c6d7e8f9',
      hash: '71e2f2babc19754cbac1d90397a18156114342e503f105d5268c60a6325bf869',
    },
    favorites: ['emerald-ape-042', 'golden-beat-207'],
    cart: [
      { nftId: 'sage-nomad-069', editionId: 'padrao', quantity: 1 },
      { nftId: 'golden-beat-207', editionId: 'padrao', quantity: 2 },
    ],
    wallets: [
      {
        slot: 'primary',
        name: 'Carteira de coleção',
        label: 'Principal',
        provider: 'metamask',
        network: 'ethereum',
        address: '0x5A3e9cB1d2F47a8E0b6C1D9e3F27a4B8c6D0E1F2',
        email: 'ana@kurio.dev',
        isDefault: true,
      },
      {
        slot: 'secondary',
        name: 'Carteira de reserva',
        label: 'Reserva',
        provider: 'phantom',
        network: 'solana',
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        email: null,
        isDefault: false,
      },
    ],
    orders: [{ number: 'KUR-1000', items: [{ nftId: 'violet-nomad-014', editionId: 'padrao', quantity: 1 }], network: 'ethereum', couponCode: null, daysAgo: 12 }],
  },
  {
    id: 'usr_bruno',
    displayName: 'Bruno Ferreira',
    username: 'brunof',
    email: 'bruno@kurio.dev',
    avatarUrl: '/images/avatars/bruno-192.webp',
    bio: 'Música, games e colecionáveis.',
    createdAt: '2025-08-02T12:00:00.000Z',
    password: {
      algorithm: 'pbkdf2-sha256',
      iterations: 100_000,
      salt: '1f2e3d4c5b6a79880716253443526170',
      hash: '1f79ef46768b0d7394ff1b73f441a3af6bd8be9d54415ac2f7e0b4f978e084e3',
    },
    favorites: ['golden-signal-198'],
    cart: [],
    wallets: [
      {
        slot: 'primary',
        name: 'Coinbase do Bruno',
        label: 'Principal',
        provider: 'coinbase',
        network: 'polygon',
        address: '0x9C1d7E4b3A2f6D8e0B5c4A3f2E1d0C9b8A7f6E5d',
        email: 'bruno@kurio.dev',
        isDefault: true,
      },
    ],
    orders: [{ number: 'KUR-1001', items: [{ nftId: 'golden-signal-198', editionId: 'padrao', quantity: 1 }], network: 'polygon', couponCode: 'KURIO10', daysAgo: 5 }],
  },
  {
    id: 'usr_carla',
    displayName: 'Carla Mendes',
    username: 'carlam',
    email: 'carla@kurio.dev',
    avatarUrl: null,
    bio: '',
    createdAt: '2026-01-20T12:00:00.000Z',
    password: {
      algorithm: 'pbkdf2-sha256',
      iterations: 100_000,
      salt: '9a8b7c6d5e4f30211203f4e5d6c7b8a9',
      hash: '60d664eb558bb071787e09bf258548ad92a33cee46dfa618a360195c242cb227',
    },
    favorites: [],
    cart: [],
    wallets: [],
    orders: [],
  },
]

/** Cupons simulados. Datas absolutas para manter os cenários determinísticos. */
export interface CouponDefinition {
  code: string
  description: string
  kind: 'percent' | 'fixed'
  /** Percentual (0–100) ou valor fixo em micro-ETH. */
  value: number
  minSubtotal: number
  validUntil: string
}

export const COUPONS: CouponDefinition[] = [
  { code: 'KURIO10', description: '10% de desconto no subtotal', kind: 'percent', value: 10, minSubtotal: 0, validUntil: '2099-12-31T23:59:59.000Z' },
  { code: 'LANCAMENTO', description: '0,05 ETH de desconto de lançamento (subtotal a partir de 0,5 ETH)', kind: 'fixed', value: 50_000, minSubtotal: 500_000, validUntil: '2099-12-31T23:59:59.000Z' },
  { code: 'BOASVINDAS', description: '5% de desconto para novos colecionadores', kind: 'percent', value: 5, minSubtotal: 0, validUntil: '2099-12-31T23:59:59.000Z' },
  { code: 'EXPIRADO', description: 'Campanha de 2025 (expirada)', kind: 'percent', value: 15, minSubtotal: 0, validUntil: '2025-12-31T23:59:59.000Z' },
]

export const NETWORK_FEES: Record<Network, number> = {
  ethereum: 12_000,
  polygon: 2_000,
  solana: 1_000,
}

/** Taxa de serviço da plataforma em pontos-base (2,5%). */
export const SERVICE_FEE_BPS = 250
