/**
 * Utilitários HTTP do backend simulado: respostas de erro padronizadas, autenticação,
 * validação com os schemas de contrato e simulação de rede (latência, falhas, timeouts, offline).
 */
import { HttpResponse, delay } from 'msw'
import type { z } from 'zod'
import type { ApiErrorBody, ErrorCode } from '@/api/contracts'
import { HEADERS } from '@/api/contracts'
import { getConfig, updateConfig, type FailureRule } from './config'
import { getDb, nowIso, type SessionRecord, type UserRecord } from './db'

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  ADDRESS_TAKEN: 409,
  AVAILABILITY_CONFLICT: 409,
  QUOTE_STALE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  WALLET_REJECTED: 409,
  WALLET_NOT_CONNECTED: 409,
  SERVICE_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  INTERNAL: 500,
}

export function apiError(
  code: ErrorCode,
  message: string,
  extra: { fieldErrors?: Record<string, string>; details?: unknown; status?: number } = {},
) {
  const status = extra.status ?? STATUS[code]
  const body: ApiErrorBody = {
    error: {
      code,
      message,
      ...(extra.fieldErrors ? { fieldErrors: extra.fieldErrors } : {}),
      ...(extra.details !== undefined ? { details: extra.details } : {}),
      retryable: status >= 500 || status === 429,
    },
  }
  return HttpResponse.json(body, { status })
}

/** Valida o corpo com o schema do contrato; devolve os dados ou uma resposta 422. */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: Response }> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return { ok: false, response: apiError('VALIDATION_ERROR', 'Corpo da requisição inválido (JSON esperado).') }
  }
  const result = schema.safeParse(json)
  if (result.success) return { ok: true, data: result.data }
  const fieldErrors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_'
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { ok: false, response: apiError('VALIDATION_ERROR', 'Verifique os campos destacados.', { fieldErrors }) }
}

export type AuthResult = { ok: true; user: UserRecord; session: SessionRecord } | { ok: false; response: Response }

export function readToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim() || null
}

export function resolveSession(token: string | null): { session: SessionRecord; user: UserRecord } | { error: 'missing' | 'invalid' | 'expired' } {
  if (!token) return { error: 'missing' }
  const db = getDb()
  const session = db.sessions[token]
  if (!session || session.revokedAt) return { error: 'invalid' }
  if (Date.parse(session.expiresAt) <= Date.now()) return { error: 'expired' }
  const user = db.users[session.userId]
  if (!user) return { error: 'invalid' }
  return { session, user }
}

export function requireAuth(request: Request): AuthResult {
  const resolved = resolveSession(readToken(request))
  if ('error' in resolved) {
    if (resolved.error === 'expired') {
      return { ok: false, response: apiError('SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente para continuar.') }
    }
    return { ok: false, response: apiError('UNAUTHENTICATED', 'Entre na sua conta para continuar.') }
  }
  return { ok: true, ...resolved }
}

/** Dono do carrinho: usuário autenticado ou carrinho de visitante (X-Cart-Id). */
export function cartOwner(request: Request): { ok: true; ownerKey: string; userId: string | null } | { ok: false; response: Response } {
  const token = readToken(request)
  if (token) {
    const auth = requireAuth(request)
    if (!auth.ok) return auth
    return { ok: true, ownerKey: `user:${auth.user.id}`, userId: auth.user.id }
  }
  const guestId = request.headers.get(HEADERS.guestCart)
  if (guestId && /^guest_[a-z0-9]{6,40}$/.test(guestId)) return { ok: true, ownerKey: `guest:${guestId}`, userId: null }
  return { ok: true, ownerKey: '', userId: null }
}

/* ------------------------------------------------------------------ */
/* Simulação de rede                                                    */
/* ------------------------------------------------------------------ */

let requestCounter = 0

/** PRNG determinístico (mulberry32) a partir da semente do cenário e do número da requisição. */
function seeded(n: number): number {
  let t = (getConfig().seed + n * 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function resetRequestCounter(): void {
  requestCounter = 0
}

function matchFailure(request: Request, path: string): FailureRule | undefined {
  const config = getConfig()
  const idx = config.failures.findIndex(
    (f) => (!f.method || f.method.toUpperCase() === request.method) && path.startsWith(f.path) && (f.times === undefined || f.times > 0),
  )
  if (idx === -1) return undefined
  const rule = config.failures[idx]
  if (rule.times !== undefined) {
    const failures = config.failures.map((f, i) => (i === idx ? { ...f, times: (f.times ?? 1) - 1 } : f))
    updateConfig({ failures })
  }
  return rule
}

/**
 * Aplica as condições de rede do cenário. Retorna uma resposta de falha quando a requisição
 * deve falhar; caso contrário aguarda a latência e retorna `undefined`.
 */
export async function simulateNetwork(request: Request): Promise<Response | undefined> {
  const config = getConfig()
  const url = new URL(request.url)
  const n = ++requestCounter

  if (config.offline) {
    await delay(150)
    return HttpResponse.error()
  }

  const failure = matchFailure(request, url.pathname)
  if (failure) {
    if (failure.status === 'network') {
      await delay(200)
      return HttpResponse.error()
    }
    if (failure.status === 'timeout') {
      await delay(30_000)
      return apiError('SERVICE_UNAVAILABLE', 'O servidor não respondeu a tempo.', { status: 504 })
    }
    await delay(150)
    const code = (failure.code as ErrorCode | undefined) ?? (failure.status >= 500 ? 'INTERNAL' : 'CONFLICT')
    return apiError(code, failure.status >= 500 ? 'Falha temporária no servidor. Tente novamente.' : 'Requisição recusada.', {
      status: failure.status,
    })
  }

  let ms = 0
  if (config.latency.mode === 'fixed') ms = config.latency.ms
  else if (config.latency.mode === 'variable') ms = config.latency.min + Math.round(seeded(n) * (config.latency.max - config.latency.min))

  if (config.outOfOrderSearch && request.method === 'GET' && url.pathname === '/api/nfts') {
    // termos mais curtos (digitados antes) respondem por último
    const q = url.searchParams.get('q') ?? ''
    ms = Math.max(80, 1600 - q.length * 400)
  }
  if (ms > 0) await delay(ms)
  return undefined
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export { nowIso }
