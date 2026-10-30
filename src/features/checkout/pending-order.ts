import { useSyncExternalStore } from 'react'
import { readString, removeKey, writeString } from '@/lib/storage'
import { useSession } from '@/session/session'

/**
 * Ponteiro do pedido pendente por usuário (localStorage). Permite retomar o acompanhamento
 * após refresh, reconexão ou fechamento da aba — sem criar outra compra.
 */
const key = (userId: string) => `kurio:pending-order:${userId}`
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function setPendingOrder(userId: string, orderId: string | null): void {
  if (orderId) writeString(key(userId), orderId)
  else removeKey(key(userId))
  notify()
}

export function getPendingOrder(userId: string): string | null {
  return readString(key(userId))
}

export function usePendingOrderId(): string | null {
  const { user } = useSession()
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (user ? getPendingOrder(user.id) : null),
    () => null,
  )
}
