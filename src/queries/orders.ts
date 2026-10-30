import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { useSession } from '@/session/session'
import { qk } from './keys'

export function useOrder(orderId: string) {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.order(user?.id ?? 'anon', orderId),
    queryFn: ({ signal }) => api.orders.get(orderId, { signal }),
    enabled: !!user,
    // fallback ao tempo real: enquanto pendente, revalida periodicamente via REST
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
    retry: (count, error) => {
      const e = toApiError(error)
      return e.isTransient && count < 2
    },
  })
}

export function useOrders() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.orders(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.orders.list({ signal }),
    enabled: !!user,
  })
}
