/**
 * Barramento de eventos do backend simulado. As mutations de domínio publicam aqui e o
 * servidor Socket.IO simulado (realtime.ts) entrega os eventos aos clientes conectados.
 */
import type { NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import { getDb, nowIso, persist } from './db'

type Listener = (event: RealtimeEvent) => void
const listeners = new Set<Listener>()
const history: RealtimeEvent[] = []
const HISTORY_LIMIT = 50

export function onRealtimeEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function publish(event: RealtimeEvent): void {
  history.push(event)
  if (history.length > HISTORY_LIMIT) history.shift()
  for (const l of listeners) l(event)
}

export function eventHistory(): readonly RealtimeEvent[] {
  return history
}

function nextEventId(): string {
  const db = getDb()
  db.seq.event += 1
  persist()
  return `evt_${String(db.seq.event).padStart(6, '0')}`
}

export function makeNftUpdated(data: NftUpdatedEvent['data'], version: number): NftUpdatedEvent {
  return { id: nextEventId(), type: 'nft.updated', resource: { type: 'nft', id: data.nftId }, version, occurredAt: nowIso(), data }
}

export function makeOrderUpdated(userId: string, data: OrderUpdatedEvent['data'], version: number): OrderUpdatedEvent {
  return { id: nextEventId(), type: 'order.updated', resource: { type: 'order', id: data.orderId }, version, userId, occurredAt: nowIso(), data }
}
