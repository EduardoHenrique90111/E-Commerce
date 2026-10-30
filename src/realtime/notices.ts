/**
 * Avisos derivados de eventos em tempo real (preço/disponibilidade, pedido) para a interface:
 * toasts, região aria-live e marcação de cotações desatualizadas no checkout.
 */
import type { NftUpdatedEvent, OrderUpdatedEvent } from '@/api/contracts'

export type RealtimeNotice = { kind: 'nft'; event: NftUpdatedEvent } | { kind: 'order'; event: OrderUpdatedEvent }
type Listener = (notice: RealtimeNotice) => void
const listeners = new Set<Listener>()

export function onRealtimeNotice(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitNotice(notice: RealtimeNotice): void {
  for (const l of listeners) l(notice)
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'
type StatusListener = (status: ConnectionStatus) => void
const statusListeners = new Set<StatusListener>()
let status: ConnectionStatus = 'idle'

export function getConnectionStatus(): ConnectionStatus {
  return status
}

export function setConnectionStatus(next: ConnectionStatus): void {
  if (next === status) return
  status = next
  for (const l of statusListeners) l(status)
}

export function onConnectionStatus(listener: StatusListener): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}
