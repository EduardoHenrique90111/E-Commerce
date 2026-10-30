/**
 * Contratos REST e de eventos do Kurio.
 *
 * Fonte única de verdade compartilhada por:
 *  - cliente HTTP (validação das respostas na fronteira de transporte),
 *  - formulários (validação de entrada),
 *  - camada de mocks (MSW) que simula o backend.
 *
 * Valores monetários são inteiros em micro-ETH (1 ETH = 1_000_000) para evitar erros de ponto flutuante.
 */
import { z } from 'zod'

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export const networkSchema = z.enum(NETWORKS)
export type Network = z.infer<typeof networkSchema>

export const COLLECTIONS = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'esportes', 'jogos', 'ilustracoes'] as const
export const collectionSchema = z.enum(COLLECTIONS)
export type CollectionSlug = z.infer<typeof collectionSchema>

export const SORTS = ['relevance', 'price-asc', 'price-desc', 'newest', 'popular'] as const
export const sortSchema = z.enum(SORTS)
export type CatalogSort = z.infer<typeof sortSchema>

export const WALLET_PROVIDERS = ['metamask', 'walletconnect', 'coinbase', 'phantom'] as const
export const walletProviderSchema = z.enum(WALLET_PROVIDERS)
export type WalletProvider = z.infer<typeof walletProviderSchema>

export const ORDER_STATUSES = ['pending', 'confirmed', 'rejected'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>

/** Inteiro em micro-ETH (1 ETH = 1_000_000). */
export const microEthSchema = z.number().int().nonnegative()
export type MicroEth = number

export const MAX_PER_ORDER = 5
export const CATALOG_PAGE_SIZE = 12

/* ------------------------------------------------------------------ */
/* Erros                                                               */
/* ------------------------------------------------------------------ */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'INVALID_CREDENTIALS',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'ADDRESS_TAKEN',
  'AVAILABILITY_CONFLICT',
  'QUOTE_STALE',
  'IDEMPOTENCY_CONFLICT',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'WALLET_REJECTED',
  'WALLET_NOT_CONNECTED',
  'SERVICE_UNAVAILABLE',
  'RATE_LIMITED',
  'INTERNAL',
] as const
export const errorCodeSchema = z.enum(ERROR_CODES)
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    /** Erros por campo (nome do campo → mensagem). */
    fieldErrors: z.record(z.string()).optional(),
    /** Indica se repetir a mesma requisição pode funcionar (falha transitória). */
    retryable: z.boolean().optional(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>

/* ------------------------------------------------------------------ */
/* Imagens e NFTs                                                      */
/* ------------------------------------------------------------------ */

export const imageSchema = z.object({
  /** Caminho base sem tamanho; o cliente monta o srcset com -320/-640/-960.webp */
  base: z.string(),
  alt: z.string(),
})
export type NftImage = z.infer<typeof imageSchema>

export const editionSchema = z.object({
  id: z.string(),
  label: z.string(),
  price: microEthSchema,
  supply: z.number().int().positive(),
  available: z.number().int().nonnegative(),
})
export type Edition = z.infer<typeof editionSchema>

export const creatorSchema = z.object({ name: z.string(), handle: z.string() })

export const nftSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  collection: collectionSchema,
  network: networkSchema,
  creator: creatorSchema,
  image: imageSchema,
  priceFrom: microEthSchema,
  available: z.number().int().nonnegative(),
  badge: z.enum(['novo', 'hot']).nullable(),
  rating: z.number(),
  reviewsCount: z.number().int(),
  /** Versão monotônica do recurso (preço/disponibilidade). */
  version: z.number().int().positive(),
})
export type NftSummary = z.infer<typeof nftSummarySchema>

export const nftDetailSchema = nftSummarySchema.extend({
  description: z.string(),
  attributes: z.array(z.string()),
  rarity: z.string(),
  serial: z.string(),
  createdAt: z.string(),
  sales: z.number().int(),
  editions: z.array(editionSchema).min(1),
  gallery: z.array(imageSchema),
  maxPerOrder: z.number().int().positive(),
})
export type NftDetail = z.infer<typeof nftDetailSchema>

export const facetCountSchema = z.object({ value: z.string(), count: z.number().int() })
export const catalogResponseSchema = z.object({
  items: z.array(nftSummarySchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  facets: z.object({
    collections: z.array(facetCountSchema),
    networks: z.array(facetCountSchema),
    priceRange: z.object({ min: microEthSchema, max: microEthSchema }),
  }),
})
export type CatalogResponse = z.infer<typeof catalogResponseSchema>

/** Parâmetros de listagem (query string de GET /api/nfts). */
export interface CatalogQuery {
  q?: string
  collections?: CollectionSlug[]
  networks?: Network[]
  minPrice?: MicroEth
  maxPrice?: MicroEth
  sort?: CatalogSort
  page?: number
  pageSize?: number
}

/* ------------------------------------------------------------------ */
/* Sessão e conta                                                      */
/* ------------------------------------------------------------------ */

export const userSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  username: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string(),
  createdAt: z.string(),
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({
  user: userSchema,
  expiresAt: z.string(),
})
export type Session = z.infer<typeof sessionSchema>

export const authResponseSchema = z.object({
  token: z.string(),
  session: sessionSchema,
})
export type AuthResponse = z.infer<typeof authResponseSchema>

const PASSWORD_RULES =
  'A senha precisa de ao menos 8 caracteres, com letra maiúscula, letra minúscula e número.'
export const passwordSchema = z
  .string()
  .min(8, PASSWORD_RULES)
  .max(72, 'Use no máximo 72 caracteres.')
  .regex(/[a-z]/, PASSWORD_RULES)
  .regex(/[A-Z]/, PASSWORD_RULES)
  .regex(/[0-9]/, PASSWORD_RULES)

export const emailSchema = z.string().trim().min(1, 'Informe seu e-mail.').email('Informe um e-mail válido.').max(120)

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe sua senha.'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const registerRequestSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(60, 'Use no máximo 60 caracteres.'),
  email: emailSchema,
  password: passwordSchema,
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>

export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Use ao menos 3 caracteres.')
  .max(24, 'Use no máximo 24 caracteres.')
  .regex(/^[a-z0-9_.]+$/, 'Use apenas letras minúsculas, números, ponto e sublinhado.')

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe ao menos 2 caracteres.').max(60, 'Use no máximo 60 caracteres.'),
  username: usernameSchema,
  email: emailSchema,
  bio: z.string().trim().max(280, 'Use no máximo 280 caracteres.'),
})
export type ProfileUpdate = z.infer<typeof profileUpdateSchema>

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const avatarUpdateSchema = z.object({
  /** data URL (já redimensionada no cliente para 256px). */
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Formato de imagem inválido. Use PNG, JPG ou WebP.')
    .max(Math.ceil((AVATAR_MAX_BYTES * 4) / 3) + 64, 'A imagem deve ter no máximo 2 MB.'),
})
export type AvatarUpdate = z.infer<typeof avatarUpdateSchema>

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem.' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'A nova senha deve ser diferente da atual.' })
export type PasswordChange = z.infer<typeof passwordChangeSchema>

/* ------------------------------------------------------------------ */
/* Carteiras                                                           */
/* ------------------------------------------------------------------ */

export const evmAddress = /^0x[a-fA-F0-9]{40}$/
export const solanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const walletSchema = z.object({
  id: z.string(),
  slot: z.enum(['primary', 'secondary']),
  name: z.string(),
  label: z.string(),
  provider: walletProviderSchema,
  network: networkSchema,
  address: z.string(),
  email: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type Wallet = z.infer<typeof walletSchema>

const walletBaseInput = z.object({
  name: z.string().trim().min(2, 'Informe o nome da carteira.').max(40, 'Use no máximo 40 caracteres.'),
  label: z.string().trim().min(2, 'Informe um apelido.').max(24, 'Use no máximo 24 caracteres.'),
  provider: walletProviderSchema,
  network: networkSchema,
  address: z.string().trim().min(1, 'Informe o endereço da carteira.'),
  email: z.union([emailSchema, z.literal('')]).optional(),
  isDefault: z.boolean().default(false),
})
const refineAddress = <T extends { network: Network; address: string }>(v: T, ctx: z.RefinementCtx) => {
  const ok = v.network === 'solana' ? solanaAddress.test(v.address) : evmAddress.test(v.address)
  if (!ok) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address'],
      message:
        v.network === 'solana'
          ? 'Endereço Solana inválido (base58, 32 a 44 caracteres).'
          : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.',
    })
  }
}
export const walletCreateSchema = walletBaseInput.extend({ slot: z.enum(['primary', 'secondary']) }).superRefine(refineAddress)
export type WalletCreate = z.input<typeof walletCreateSchema>
export const walletUpdateSchema = walletBaseInput.superRefine(refineAddress)
export type WalletUpdate = z.input<typeof walletUpdateSchema>

export const walletConnectionSchema = z.object({
  walletId: z.string(),
  network: networkSchema,
  status: z.literal('connected'),
  connectedAt: z.string(),
})
export type WalletConnection = z.infer<typeof walletConnectionSchema>

/* ------------------------------------------------------------------ */
/* Favoritos                                                           */
/* ------------------------------------------------------------------ */

export const favoritesResponseSchema = z.object({
  ids: z.array(z.string()),
  items: z.array(nftSummarySchema),
})
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>

/* ------------------------------------------------------------------ */
/* Carrinho e cotação                                                  */
/* ------------------------------------------------------------------ */

export const cartLineSchema = z.object({
  lineId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  editionLabel: z.string(),
  image: imageSchema,
  quantity: z.number().int().positive(),
  unitPrice: microEthSchema,
  /** Preço visto quando o item entrou no carrinho (para sinalizar mudança). */
  addedUnitPrice: microEthSchema,
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
  nftVersion: z.number().int(),
})
export type CartLine = z.infer<typeof cartLineSchema>

export const cartSchema = z.object({
  id: z.string(),
  owner: z.enum(['guest', 'user']),
  items: z.array(cartLineSchema),
  couponCode: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
  version: z.number().int(),
})
export type Cart = z.infer<typeof cartSchema>

export const addCartItemSchema = z.object({
  nftId: z.string().min(1),
  editionId: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_PER_ORDER),
})
export type AddCartItem = z.infer<typeof addCartItemSchema>

export const updateCartItemSchema = z.object({ quantity: z.number().int().min(1).max(MAX_PER_ORDER) })
export const couponRequestSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Informe um código com ao menos 3 caracteres.')
    .max(24, 'Código muito longo.')
    .transform((s) => s.toUpperCase()),
})

export const quoteIssueSchema = z.object({
  type: z.enum(['price_changed', 'unavailable', 'quantity_reduced', 'coupon_invalid', 'coupon_expired']),
  lineId: z.string().optional(),
  nftId: z.string().optional(),
  message: z.string(),
  previous: z.number().optional(),
  current: z.number().optional(),
})
export type QuoteIssue = z.infer<typeof quoteIssueSchema>

export const quoteLineSchema = z.object({
  lineId: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  editionLabel: z.string(),
  image: imageSchema,
  quantity: z.number().int().nonnegative(),
  unitPrice: microEthSchema,
  lineTotal: microEthSchema,
  nftVersion: z.number().int(),
  available: z.number().int().nonnegative(),
})
export type QuoteLine = z.infer<typeof quoteLineSchema>

export const quoteSchema = z.object({
  quoteId: z.string(),
  network: networkSchema,
  items: z.array(quoteLineSchema),
  subtotal: microEthSchema,
  discount: microEthSchema,
  coupon: z
    .object({ code: z.string(), status: z.enum(['applied', 'invalid', 'expired']), description: z.string() })
    .nullable(),
  serviceFee: microEthSchema,
  networkFee: microEthSchema,
  total: microEthSchema,
  issues: z.array(quoteIssueSchema),
  /** true quando a cotação pode ser usada para criar um pedido. */
  valid: z.boolean(),
  createdAt: z.string(),
  expiresAt: z.string(),
})
export type Quote = z.infer<typeof quoteSchema>

export const quoteRequestSchema = z.object({ network: networkSchema.default('ethereum') })

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

export const collectorSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome de exibição.').max(60, 'Use no máximo 60 caracteres.'),
  email: emailSchema,
  note: z.string().trim().max(280, 'Use no máximo 280 caracteres.').optional().default(''),
})
export type Collector = z.input<typeof collectorSchema>

export const createOrderSchema = z.object({
  quoteId: z.string().min(1),
  walletId: z.string().min(1, 'Selecione uma carteira.'),
  network: networkSchema,
  collector: collectorSchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Confirme que revisou o pedido.' }) }),
})
export type CreateOrderRequest = z.input<typeof createOrderSchema>

export const orderItemSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  editionLabel: z.string(),
  image: imageSchema,
  quantity: z.number().int().positive(),
  unitPrice: microEthSchema,
  lineTotal: microEthSchema,
  serial: z.string(),
})
export type OrderItem = z.infer<typeof orderItemSchema>

export const orderSchema = z.object({
  id: z.string(),
  number: z.string(),
  status: orderStatusSchema,
  version: z.number().int().positive(),
  userId: z.string(),
  quoteId: z.string(),
  network: networkSchema,
  wallet: z.object({ id: z.string(), label: z.string(), address: z.string(), provider: walletProviderSchema }),
  collector: z.object({ name: z.string(), email: z.string(), note: z.string() }),
  items: z.array(orderItemSchema),
  subtotal: microEthSchema,
  discount: microEthSchema,
  couponCode: z.string().nullable(),
  serviceFee: microEthSchema,
  networkFee: microEthSchema,
  total: microEthSchema,
  transaction: z.object({ hash: z.string(), explorerUrl: z.string(), network: networkSchema }).nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  settledAt: z.string().nullable(),
})
export type Order = z.infer<typeof orderSchema>

export const orderSummarySchema = orderSchema.pick({
  id: true,
  number: true,
  status: true,
  version: true,
  total: true,
  createdAt: true,
  network: true,
}).extend({ itemCount: z.number().int() })
export type OrderSummary = z.infer<typeof orderSummarySchema>

/* ------------------------------------------------------------------ */
/* Eventos em tempo real (Socket.IO)                                   */
/* ------------------------------------------------------------------ */

export const nftUpdatedDataSchema = z.object({
  nftId: z.string(),
  name: z.string(),
  editions: z.array(editionSchema.pick({ id: true, price: true, available: true })),
  priceFrom: microEthSchema,
  available: z.number().int().nonnegative(),
  reason: z.enum(['price', 'availability', 'price_and_availability']),
  previous: z.object({ priceFrom: microEthSchema, available: z.number().int() }),
})
export const orderUpdatedDataSchema = z.object({
  orderId: z.string(),
  number: z.string(),
  status: orderStatusSchema,
  failureReason: z.string().nullable(),
  transaction: orderSchema.shape.transaction,
})

const eventBase = {
  /** Identidade estável do evento (deduplicação). */
  id: z.string(),
  /** Versão do recurso após o evento (ordenação). */
  version: z.number().int().positive(),
  occurredAt: z.string(),
}
export const nftUpdatedEventSchema = z.object({
  ...eventBase,
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  data: nftUpdatedDataSchema,
})
export const orderUpdatedEventSchema = z.object({
  ...eventBase,
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  /** Dono do pedido: o cliente descarta eventos de outro usuário. */
  userId: z.string(),
  data: orderUpdatedDataSchema,
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>
export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

export const REALTIME_EVENTS = ['nft.updated', 'order.updated'] as const

/* ------------------------------------------------------------------ */
/* Cabeçalhos                                                          */
/* ------------------------------------------------------------------ */

export const HEADERS = {
  idempotencyKey: 'Idempotency-Key',
  idempotentReplay: 'Idempotent-Replayed',
  guestCart: 'X-Cart-Id',
  requestId: 'X-Request-Id',
} as const

/* ------------------------------------------------------------------ */
/* Envelopes de resposta                                               */
/* ------------------------------------------------------------------ */

export const sessionResponseSchema = z.object({ session: sessionSchema })
export const relatedResponseSchema = z.object({ items: z.array(nftSummarySchema) })
export const walletConnectionStateSchema = z
  .object({ walletId: z.string(), network: networkSchema, connectedAt: z.string() })
  .nullable()
export type WalletConnectionState = z.infer<typeof walletConnectionStateSchema>
export const walletsResponseSchema = z.object({ items: z.array(walletSchema), connection: walletConnectionStateSchema })
export type WalletsResponse = z.infer<typeof walletsResponseSchema>
export const ordersResponseSchema = z.object({ items: z.array(orderSummarySchema) })
