/**
 * Sessão do colecionador.
 *
 *  - fonte de verdade: query ['session'] (GET /api/auth/session) + token em tokenStore;
 *  - recuperável após refresh (token persistido) e validada no servidor a cada carregamento;
 *  - logout/expiração/troca de usuário: removem dados privados do cache, rascunhos e a conexão
 *    Socket.IO da sessão anterior.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/api/endpoints'
import type { AuthResponse, Session } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { queryClient } from '@/app/query-client'
import { removeByPrefix } from '@/lib/storage'
import { qk } from '@/queries/keys'
import { realtime } from '@/realtime/instance'
import { guestCartStore, tokenStore } from './token-store'

export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: qk.session,
    queryFn: async ({ signal }): Promise<Session | null> => {
      if (!tokenStore.get()) return null
      try {
        const { session } = await api.auth.session({ signal })
        return session
      } catch (error) {
        const e = toApiError(error)
        if (e.isAuthError) {
          tokenStore.set(null)
          return null
        }
        throw e
      }
    },
    staleTime: 5 * 60_000,
    gcTime: Infinity,
  })

export function useSession() {
  const query = useQuery(sessionQueryOptions())
  const session = query.data ?? null
  return {
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isLoading: query.isPending,
    error: query.error,
  }
}

export function getCurrentUserId(): string | null {
  return queryClient.getQueryData<Session | null>(qk.session)?.user.id ?? null
}

/** Remove do cache tudo que pertence a um usuário (e o carrinho, cujo dono muda). */
export function clearPrivateData(options: { keepDrafts?: boolean } = {}): void {
  queryClient.cancelQueries({ queryKey: ['user'] })
  queryClient.removeQueries({ queryKey: ['user'] })
  queryClient.removeQueries({ queryKey: qk.cartAll })
  if (!options.keepDrafts) removeByPrefix('kurio:checkout:', 'session')
}

/** Login/cadastro concluído. */
export function completeAuth(auth: AuthResponse): void {
  const previousUserId = getCurrentUserId()
  if (previousUserId && previousUserId !== auth.session.user.id) clearPrivateData()
  tokenStore.set(auth.token)
  guestCartStore.set(null) // o carrinho de visitante foi unido ao do usuário pelo servidor
  queryClient.removeQueries({ queryKey: qk.cartAll })
  queryClient.setQueryData(qk.session, auth.session)
  void realtime.connect({ token: auth.token, userId: auth.session.user.id })
}

/** Logout explícito. */
export async function logout(): Promise<void> {
  try {
    await api.auth.logout()
  } catch {
    /* o token é descartado localmente mesmo se o servidor estiver indisponível */
  }
  tokenStore.set(null)
  clearPrivateData()
  removeByPrefix('kurio:pending-order:')
  queryClient.setQueryData(qk.session, null)
  void realtime.connect({ token: null, userId: null })
}

/**
 * Sessão expirada (401 SESSION_EXPIRED, timer de expiração ou outra aba).
 * Mantém os rascunhos (checkout) para retomada após novo login do mesmo usuário.
 */
export function expireSession(): void {
  if (!tokenStore.get() && !queryClient.getQueryData(qk.session)) return
  tokenStore.set(null)
  clearPrivateData({ keepDrafts: true })
  queryClient.setQueryData(qk.session, null)
  void realtime.connect({ token: null, userId: null })
}

/** Caminho de retorno seguro (apenas rotas internas). */
export function safeRedirect(target: string | undefined | null, fallback = '/'): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/entrar') || target.startsWith('/cadastro')) return fallback
  return target
}
