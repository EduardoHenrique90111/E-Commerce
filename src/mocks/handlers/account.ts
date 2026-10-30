import { http, HttpResponse, delay } from 'msw'
import { z } from 'zod'
import {
  avatarUpdateSchema,
  networkSchema,
  passwordChangeSchema,
  profileUpdateSchema,
  walletCreateSchema,
  walletUpdateSchema,
  type WalletConnection,
} from '@/api/contracts'
import { getConfig, updateConfig } from '../config'
import { hashPassword, verifyPassword } from '../crypto'
import { getDb, nowIso, persist, type WalletRecord } from '../db'
import { walletView } from '../domain'
import { apiError, parseBody, requireAuth, simulateNetwork } from '../http'
import { userView } from './auth'

const RESERVED_USERNAMES = ['admin', 'kurio', 'root', 'suporte', 'support']

export const accountHandlers = [
  /* ---------------- Perfil ---------------- */
  http.get('/api/profile', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    return HttpResponse.json(userView(auth.user))
  }),

  http.patch('/api/profile', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const parsed = await parseBody(request, profileUpdateSchema)
    if (!parsed.ok) return parsed.response
    const db = getDb()
    const { displayName, username, email, bio } = parsed.data
    if (RESERVED_USERNAMES.includes(username)) {
      return apiError('VALIDATION_ERROR', 'Verifique os campos destacados.', { fieldErrors: { username: 'Este nome de usuário é reservado.' } })
    }
    const others = Object.values(db.users).filter((u) => u.id !== auth.user.id)
    if (others.some((u) => u.username === username)) {
      return apiError('USERNAME_TAKEN', 'Nome de usuário indisponível.', { fieldErrors: { username: 'Este nome de usuário já está em uso.' } })
    }
    if (others.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return apiError('EMAIL_TAKEN', 'E-mail já cadastrado.', { fieldErrors: { email: 'Este e-mail já pertence a outra conta.' } })
    }
    Object.assign(auth.user, { displayName, username, email: email.toLowerCase(), bio })
    persist()
    return HttpResponse.json(userView(auth.user))
  }),

  http.put('/api/profile/avatar', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const parsed = await parseBody(request, avatarUpdateSchema)
    if (!parsed.ok) return parsed.response
    auth.user.avatarUrl = parsed.data.dataUrl
    persist()
    return HttpResponse.json(userView(auth.user))
  }),

  http.delete('/api/profile/avatar', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    auth.user.avatarUrl = null
    persist()
    return HttpResponse.json(userView(auth.user))
  }),

  http.post('/api/profile/password', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const parsed = await parseBody(request, passwordChangeSchema)
    if (!parsed.ok) return parsed.response
    const ok = await verifyPassword(parsed.data.currentPassword, auth.user.password)
    if (!ok) {
      return apiError('VALIDATION_ERROR', 'Verifique os campos destacados.', { fieldErrors: { currentPassword: 'Senha atual incorreta.' } })
    }
    auth.user.password = await hashPassword(parsed.data.newPassword)
    // revoga as demais sessões do usuário, mantendo a atual
    const db = getDb()
    for (const s of Object.values(db.sessions)) {
      if (s.userId === auth.user.id && s.token !== auth.session.token && !s.revokedAt) s.revokedAt = nowIso()
    }
    persist()
    return new HttpResponse(null, { status: 204 })
  }),

  /* ---------------- Carteiras ---------------- */
  http.get('/api/wallets', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const db = getDb()
    const items = db.wallets.filter((w) => w.userId === auth.user.id).sort((a) => (a.slot === 'primary' ? -1 : 1)).map(walletView)
    return HttpResponse.json({ items, connection: db.walletConnections[auth.user.id] ?? null })
  }),

  http.post('/api/wallets', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const parsed = await parseBody(request, walletCreateSchema)
    if (!parsed.ok) return parsed.response
    const db = getDb()
    const mine = db.wallets.filter((w) => w.userId === auth.user.id)
    if (mine.some((w) => w.slot === parsed.data.slot)) {
      return apiError('CONFLICT', parsed.data.slot === 'primary' ? 'Você já tem uma carteira principal.' : 'Você já tem uma carteira secundária.')
    }
    if (parsed.data.slot === 'secondary' && !mine.some((w) => w.slot === 'primary')) {
      return apiError('VALIDATION_ERROR', 'Cadastre a carteira principal antes da secundária.')
    }
    if (db.wallets.some((w) => w.address.toLowerCase() === parsed.data.address.toLowerCase())) {
      return apiError('ADDRESS_TAKEN', 'Endereço já cadastrado.', { fieldErrors: { address: 'Este endereço já está cadastrado em uma carteira.' } })
    }
    const now = nowIso()
    const isDefault = parsed.data.slot === 'primary' ? mine.length === 0 || parsed.data.isDefault : parsed.data.isDefault
    if (isDefault) for (const w of mine) w.isDefault = false
    const wallet: WalletRecord = {
      id: `wal_${++db.seq.wallet}`,
      userId: auth.user.id,
      slot: parsed.data.slot,
      name: parsed.data.name,
      label: parsed.data.label,
      provider: parsed.data.provider,
      network: parsed.data.network,
      address: parsed.data.address,
      email: parsed.data.email || null,
      isDefault: isDefault || mine.length === 0,
      createdAt: now,
      updatedAt: now,
    }
    db.wallets.push(wallet)
    persist()
    return HttpResponse.json(walletView(wallet), { status: 201 })
  }),

  http.patch('/api/wallets/:id', async ({ request, params }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const db = getDb()
    const wallet = db.wallets.find((w) => w.id === params.id)
    if (!wallet) return apiError('NOT_FOUND', 'Carteira não encontrada.')
    if (wallet.userId !== auth.user.id) return apiError('FORBIDDEN', 'Esta carteira pertence a outra conta.')
    const parsed = await parseBody(request, walletUpdateSchema)
    if (!parsed.ok) return parsed.response
    if (db.wallets.some((w) => w.id !== wallet.id && w.address.toLowerCase() === parsed.data.address.toLowerCase())) {
      return apiError('ADDRESS_TAKEN', 'Endereço já cadastrado.', { fieldErrors: { address: 'Este endereço já está cadastrado em uma carteira.' } })
    }
    const mine = db.wallets.filter((w) => w.userId === auth.user.id)
    if (parsed.data.isDefault) for (const w of mine) w.isDefault = false
    Object.assign(wallet, {
      name: parsed.data.name,
      label: parsed.data.label,
      provider: parsed.data.provider,
      network: parsed.data.network,
      address: parsed.data.address,
      email: parsed.data.email || null,
      isDefault: parsed.data.isDefault || (wallet.isDefault && !parsed.data.isDefault && mine.length === 1),
      updatedAt: nowIso(),
    })
    if (!mine.some((w) => w.isDefault)) mine.find((w) => w.slot === 'primary')!.isDefault = true
    // alterar endereço/rede invalida a conexão ativa
    const conn = db.walletConnections[auth.user.id]
    if (conn?.walletId === wallet.id) db.walletConnections[auth.user.id] = null
    persist()
    return HttpResponse.json(walletView(wallet))
  }),

  /** Simula a conexão com a extensão da carteira (aprovação, recusa). */
  http.post('/api/wallets/:id/connection', async ({ request, params }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const parsed = await parseBody(request, z.object({ network: networkSchema }))
    if (!parsed.ok) return parsed.response
    const db = getDb()
    const wallet = db.wallets.find((w) => w.id === params.id)
    if (!wallet) return apiError('NOT_FOUND', 'Carteira não encontrada.')
    if (wallet.userId !== auth.user.id) return apiError('FORBIDDEN', 'Esta carteira pertence a outra conta.')
    await delay(600) // tempo de "aprovação" na carteira
    if (getConfig().walletRejections > 0) {
      updateConfig({ walletRejections: getConfig().walletRejections - 1 })
      return apiError('WALLET_REJECTED', 'A conexão foi recusada na carteira. Tente novamente e aprove a solicitação.')
    }
    if (wallet.network !== parsed.data.network && wallet.provider === 'phantom' && parsed.data.network !== 'solana') {
      return apiError('VALIDATION_ERROR', 'A carteira Phantom só opera na rede Solana nesta simulação.', { fieldErrors: { network: 'Rede incompatível com a carteira.' } })
    }
    const connection: WalletConnection = { walletId: wallet.id, network: parsed.data.network, status: 'connected', connectedAt: nowIso() }
    db.walletConnections[auth.user.id] = { walletId: wallet.id, network: parsed.data.network, connectedAt: connection.connectedAt }
    persist()
    return HttpResponse.json(connection)
  }),

  http.delete('/api/wallets/:id/connection', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    getDb().walletConnections[auth.user.id] = null
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]
