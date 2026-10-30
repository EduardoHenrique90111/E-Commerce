/**
 * Chaves de idempotência para criação de pedidos.
 * A mesma tentativa (mesmo conteúdo) reutiliza a mesma chave — inclusive após timeout ou refresh —
 * para que o servidor devolva o mesmo pedido em vez de criar outro.
 */
import { readJson, removeKey, writeJson } from './storage'

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `ord-${crypto.randomUUID()}`
  return `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

export interface OrderAttempt<P> {
  key: string
  fingerprint: string
  payload: P
  startedAt: string
}

const attemptKey = (userId: string) => `kurio:checkout:attempt:${userId}`

export function loadAttempt<P>(userId: string): OrderAttempt<P> | null {
  return readJson<OrderAttempt<P>>(attemptKey(userId), 'session')
}

/** Reaproveita a tentativa existente se o conteúdo for o mesmo; caso contrário cria outra chave. */
export function attemptFor<P>(userId: string, payload: P): OrderAttempt<P> {
  const fingerprint = canonicalJson(payload)
  const existing = loadAttempt<P>(userId)
  if (existing && existing.fingerprint === fingerprint) return existing
  const attempt = { key: newIdempotencyKey(), fingerprint, payload, startedAt: new Date().toISOString() }
  writeJson(attemptKey(userId), attempt, 'session')
  return attempt
}

export function clearAttempt(userId: string): void {
  removeKey(attemptKey(userId), 'session')
}
