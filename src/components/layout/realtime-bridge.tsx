import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/format'
import { onRealtimeNotice } from '@/realtime/notices'
import { realtime } from '@/realtime/instance'
import { tokenStore } from '@/session/token-store'
import { useSession } from '@/session/session'

/**
 * Liga a sessão à conexão Socket.IO e transforma eventos aplicados em feedback acessível.
 * Cada usuário (ou visitante) tem a própria conexão; trocar de sessão reabre a conexão.
 */
export function RealtimeBridge() {
  const { user, isLoading } = useSession()
  const navigate = useNavigate()
  const userId = user?.id ?? null

  useEffect(() => {
    if (isLoading) return
    void realtime.connect({ token: userId ? tokenStore.get() : null, userId })
    return () => realtime.disconnect()
  }, [userId, isLoading])

  useEffect(
    () =>
      onRealtimeNotice((notice) => {
        if (notice.kind === 'nft') {
          const { data } = notice.event
          const priceChanged = data.priceFrom !== data.previous.priceFrom
          const soldOut = data.available === 0
          const message = soldOut
            ? `${data.name} esgotou.`
            : priceChanged
              ? `Preço de ${data.name} atualizado: ${formatEth(data.previous.priceFrom)} → ${formatEth(data.priceFrom)}.`
              : `Disponibilidade de ${data.name} atualizada: ${data.available} edição(ões).`
          toast.info('Atualização em tempo real', { description: message, id: `nft-${data.nftId}` })
          announce(message)
        } else {
          const { data } = notice.event
          if (data.status === 'confirmed') {
            toast.success(`Pedido ${data.number} confirmado`, {
              description: 'A transação foi confirmada.',
              id: `order-${data.orderId}`,
              action: { label: 'Ver recibo', onClick: () => void navigate({ to: '/pedidos/$orderId', params: { orderId: data.orderId } }) },
            })
            announce(`Pedido ${data.number} confirmado.`)
          } else if (data.status === 'rejected') {
            toast.error(`Pedido ${data.number} recusado`, { description: data.failureReason ?? undefined, id: `order-${data.orderId}` })
            announce(`Pedido ${data.number} recusado. ${data.failureReason ?? ''}`, 'assertive')
          }
        }
      }),
    [navigate],
  )
  return null
}
