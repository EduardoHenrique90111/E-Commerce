import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AddCartItem, Cart, Network } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError, toApiError } from '@/api/errors'
import { announce } from '@/lib/announce'
import { useSession } from '@/session/session'
import { qk } from './keys'

/** Dono do carrinho no cache: usuário autenticado ou visitante. */
export function useCartOwner(): string {
  const { user } = useSession()
  return user ? `user:${user.id}` : 'guest'
}

export const cartQueryOptions = (owner: string) =>
  queryOptions({
    queryKey: qk.cart(owner),
    queryFn: ({ signal }) => api.cart.get({ signal }),
    staleTime: 10_000,
  })

export function useCart() {
  const owner = useCartOwner()
  const { isLoading } = useSession()
  return useQuery({ ...cartQueryOptions(owner), enabled: !isLoading })
}

/** Respostas de mutations podem chegar fora de ordem: só aplica uma versão mais nova do carrinho. */
function setCartIfNewer(qc: ReturnType<typeof useQueryClient>, owner: string, cart: Cart) {
  qc.setQueryData<Cart>(qk.cart(owner), (old) => (!old || cart.version >= old.version ? cart : old))
}

export function useAddToCart() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: (body: AddCartItem) => api.cart.addItem(body),
    onSuccess: (cart) => setCartIfNewer(qc, owner, cart),
    onError: () => void qc.invalidateQueries({ queryKey: qk.nftDetails }),
  })
}

/** Alteração de quantidade com atualização otimista e rollback em caso de falha. */
export function useUpdateCartQuantity() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) => api.cart.updateItem(lineId, quantity),
    onMutate: async ({ lineId, quantity }) => {
      await qc.cancelQueries({ queryKey: qk.cart(owner) })
      const previous = qc.getQueryData<Cart>(qk.cart(owner))
      if (previous) {
        const items = previous.items.map((i) => (i.lineId === lineId ? { ...i, quantity } : i))
        qc.setQueryData<Cart>(qk.cart(owner), { ...previous, items, itemCount: items.reduce((s, i) => s + i.quantity, 0) })
      }
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) qc.setQueryData(qk.cart(owner), context.previous)
      const message = toApiError(error).message
      toast.error('Não foi possível alterar a quantidade', { description: message })
      announce(`Erro: ${message}. A quantidade anterior foi restaurada.`, 'assertive')
    },
    onSuccess: (cart) => setCartIfNewer(qc, owner, cart),
    onSettled: () => void qc.invalidateQueries({ queryKey: qk.cart(owner) }),
  })
}

export function useRemoveCartItem() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: (lineId: string) => api.cart.removeItem(lineId),
    onSuccess: (cart) => setCartIfNewer(qc, owner, cart),
  })
}

export function useApplyCoupon() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: (code: string) => api.cart.applyCoupon(code),
    onSuccess: (cart) => setCartIfNewer(qc, owner, cart),
  })
}

export function useRemoveCoupon() {
  const qc = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: () => api.cart.removeCoupon(),
    onSuccess: (cart) => setCartIfNewer(qc, owner, cart),
  })
}

/** Cotação do resumo do carrinho (recalculada a cada nova versão do carrinho ou dos NFTs nele). */
export function useCartQuote(cart: Cart | undefined, network: Network = 'ethereum') {
  const owner = useCartOwner()
  return useQuery({
    // a cotação depende da versão do carrinho e das versões (preço/estoque) de cada NFT
    queryKey: qk.quote(owner, network, cart ? `${cart.version}:${cart.items.map((i) => `${i.lineId}@${i.nftVersion}`).join(',')}` : 'empty'),
    queryFn: ({ signal }) => api.quotes.create(network, { signal }),
    enabled: !!cart && cart.items.length > 0,
    staleTime: 15_000,
  })
}

export function isAvailabilityError(error: unknown): error is ApiError {
  return toApiError(error).code === 'AVAILABILITY_CONFLICT'
}
