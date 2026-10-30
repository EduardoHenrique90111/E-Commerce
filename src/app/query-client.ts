import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { toApiError } from '@/api/errors'

/**
 * Política de cache e retries (documentada em ARCHITECTURE.md):
 *  - consultas públicas: staleTime 30 s, gcTime 5 min, refetch ao focar/reconectar;
 *  - retry automático apenas para falhas transitórias (rede, timeout, 5xx, 429): até 2 vezes com backoff;
 *  - erros 4xx nunca são repetidos; mutations não têm retry automático (exceto criação de pedido,
 *    que é idempotente e tem reenvio controlado pelo checkout).
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache(),
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          const e = toApiError(error)
          if (e.kind === 'canceled' || !e.isTransient) return false
          return failureCount < 2
        },
        retryDelay: (attempt) => Math.min(400 * 2 ** attempt, 3000),
      },
      mutations: { retry: false },
    },
  })
}

export const queryClient = createQueryClient()
