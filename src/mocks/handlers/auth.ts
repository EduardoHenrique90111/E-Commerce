import { http, HttpResponse } from 'msw'
import { HEADERS, loginRequestSchema, registerRequestSchema, type AuthResponse, type Session } from '@/api/contracts'
import { getConfig } from '../config'
import { hashPassword, newToken, verifyPassword } from '../crypto'
import { getDb, nowIso, persist, type UserRecord } from '../db'
import { mergeGuestCart } from '../domain'
import { apiError, parseBody, readToken, requireAuth, simulateNetwork } from '../http'

export function userView(u: UserRecord) {
  return { id: u.id, displayName: u.displayName, username: u.username, email: u.email, avatarUrl: u.avatarUrl, bio: u.bio, createdAt: u.createdAt }
}

function startSession(user: UserRecord): AuthResponse {
  const db = getDb()
  const token = newToken()
  const now = Date.now()
  const expiresAt = new Date(now + getConfig().sessionTtlMs).toISOString()
  db.sessions[token] = { token, userId: user.id, createdAt: new Date(now).toISOString(), expiresAt, revokedAt: null }
  persist()
  return { token, session: { user: userView(user), expiresAt } }
}

function guestCartId(request: Request): string | null {
  const id = request.headers.get(HEADERS.guestCart)
  return id && /^guest_[a-z0-9]{6,40}$/.test(id) ? id : null
}

function slugUsername(name: string): string {
  const db = getDb()
  const base =
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 16) || 'colecionador'
  let candidate = base
  let i = 1
  const taken = new Set(Object.values(db.users).map((u) => u.username))
  while (taken.has(candidate)) candidate = `${base}${++i}`
  return candidate
}

/** Tentativas de login erradas permitidas antes do bloqueio temporário do e-mail. */
export const MAX_LOGIN_FAILURES = 5
export const LOGIN_LOCK_MS = 5 * 60_000

function loginLocked(until: number) {
  const seconds = Math.max(1, Math.ceil((until - Date.now()) / 1000))
  const minutes = Math.ceil(seconds / 60)
  return apiError('RATE_LIMITED', `Muitas tentativas de login. Por segurança, tente novamente em ${minutes} minuto(s).`, {
    headers: { 'Retry-After': String(seconds) },
  })
}

export const authHandlers = [
  http.post('/api/auth/register', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const parsed = await parseBody(request, registerRequestSchema)
    if (!parsed.ok) return parsed.response
    const db = getDb()
    const email = parsed.data.email.toLowerCase()
    if (Object.values(db.users).some((u) => u.email.toLowerCase() === email)) {
      return apiError('EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', { fieldErrors: { email: 'Este e-mail já está cadastrado. Entre ou use outro e-mail.' } })
    }
    db.seq.user += 1
    const user: UserRecord = {
      id: `usr_${db.seq.user.toString(36)}${Date.now().toString(36)}`,
      displayName: parsed.data.displayName,
      username: slugUsername(parsed.data.displayName),
      email,
      avatarUrl: null,
      bio: '',
      createdAt: nowIso(),
      password: await hashPassword(parsed.data.password),
    }
    db.users[user.id] = user
    db.favorites[user.id] = []
    db.walletConnections[user.id] = null
    persist()
    mergeGuestCart(guestCartId(request), user.id)
    return HttpResponse.json(startSession(user), { status: 201 })
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const parsed = await parseBody(request, loginRequestSchema)
    if (!parsed.ok) return parsed.response
    const db = getDb()
    const email = parsed.data.email.toLowerCase()
    const failKey = `loginFail:${email}`
    const lockKey = `loginLock:${email}`

    // proteção contra força bruta: após várias senhas erradas, o e-mail fica bloqueado por alguns minutos
    const lockedUntil = db.counters[lockKey] ?? 0
    if (lockedUntil > Date.now()) return loginLocked(lockedUntil)

    const user = Object.values(db.users).find((u) => u.email.toLowerCase() === email)
    // mesma mensagem para e-mail inexistente e senha errada (não revela contas)
    const valid = user ? await verifyPassword(parsed.data.password, user.password) : false
    if (!user || !valid) {
      const failures = (db.counters[failKey] ?? 0) + 1
      if (failures >= MAX_LOGIN_FAILURES) {
        delete db.counters[failKey]
        db.counters[lockKey] = Date.now() + LOGIN_LOCK_MS
        persist()
        return loginLocked(db.counters[lockKey])
      }
      db.counters[failKey] = failures
      persist()
      const left = MAX_LOGIN_FAILURES - failures
      return apiError(
        'INVALID_CREDENTIALS',
        left <= 2 ? `E-mail ou senha incorretos. Restam ${left} tentativa(s) antes do bloqueio temporário.` : 'E-mail ou senha incorretos.',
      )
    }
    delete db.counters[failKey]
    delete db.counters[lockKey]
    const response = startSession(user)
    mergeGuestCart(guestCartId(request), user.id)
    return HttpResponse.json(response)
  }),

  http.get('/api/auth/session', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const body: { session: Session } = { session: { user: userView(auth.user), expiresAt: auth.session.expiresAt } }
    return HttpResponse.json(body)
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const token = readToken(request)
    const db = getDb()
    if (token && db.sessions[token]) {
      db.sessions[token].revokedAt = nowIso()
      persist()
    }
    return new HttpResponse(null, { status: 204 })
  }),
]
