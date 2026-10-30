import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { onAuthFailure } from '@/api/client'
import { announce } from '@/lib/announce'
import { qk } from '@/queries/keys'
import { clearPrivateData, expireSession, useSession } from '@/session/session'
import { tokenStore } from '@/session/token-store'

const PRIVATE_PREFIXES = ['/pagamento', '/perfil', '/pedidos', '/favoritos']

/**
 * Trata expiração de sessão durante a navegação e o checkout:
 *  - 401 vindo da API (sessão expirada/inválida);
 *  - timer até `expiresAt`;
 *  - login/logout feito em outra aba.
 * Em rotas privadas redireciona para /entrar preservando o caminho para retomada.
 */
export function SessionWatcher() {
  const router = useRouter()
  const qc = useQueryClient()
  const { session } = useSession()

  useEffect(() => {
    const handleExpired = () => {
      const wasAuthenticated = !!qc.getQueryData(qk.session)
      expireSession()
      if (!wasAuthenticated) return
      const location = router.state.location
      const message = 'Sua sessão expirou. Entre novamente para continuar de onde parou.'
      announce(message, 'assertive')
      if (PRIVATE_PREFIXES.some((p) => location.pathname.startsWith(p))) {
        void router.navigate({ to: '/entrar', search: { redirect: location.href, reason: 'expired' }, replace: true })
      } else {
        toast.warning('Sessão expirada', { description: message, id: 'session-expired' })
      }
    }
    const offAuth = onAuthFailure(handleExpired)
    const offToken = tokenStore.subscribe((token, source) => {
      if (source !== 'external') return
      const current = qc.getQueryData<{ user: { id: string } } | null>(qk.session)
      if (!token && current) {
        // logout em outra aba
        clearPrivateData()
        qc.setQueryData(qk.session, null)
      } else if (token) {
        // troca de usuário em outra aba: descarta os dados privados antes de carregar a nova sessão
        clearPrivateData()
        void qc.invalidateQueries({ queryKey: qk.session })
      }
    })
    return () => {
      offAuth()
      offToken()
    }
  }, [qc, router])

  useEffect(() => {
    if (!session) return
    const ms = Date.parse(session.expiresAt) - Date.now()
    if (ms > 2_147_000_000) return
    const timer = window.setTimeout(() => {
      // confirma com o servidor; a resposta 401 dispara o fluxo de expiração (onAuthFailure)
      void qc.invalidateQueries({ queryKey: qk.session })
    }, Math.max(0, ms + 250))
    return () => window.clearTimeout(timer)
  }, [session, qc])

  return null
}
