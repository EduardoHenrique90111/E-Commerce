/**
 * Cliente de tempo real (socket.io-client).
 *
 *  - uma conexão por sessão (geração): login, logout ou troca de usuário encerram a conexão
 *    anterior, removem os listeners e descartam eventos atrasados da sessão antiga;
 *  - deduplicação por `id` do evento e ordenação por `version` do recurso;
 *  - após reconexão, reconcilia os recursos ativos com a API REST (invalidação das queries).
 *
 * O socket.io-client é carregado sob demanda: além de tirar o módulo do caminho crítico,
 * garante que o WebSocket já foi instrumentado pela camada de mocks quando ela está ativa.
 */
import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { nftUpdatedEventSchema, orderUpdatedEventSchema, type RealtimeEvent } from '@/api/contracts'
import { env } from '@/env'
import { qk } from '@/queries/keys'
import { applyNftUpdated, applyOrderUpdated } from './apply'
import { emitNotice, setConnectionStatus } from './notices'

const SEEN_LIMIT = 500

export class RealtimeClient {
  private socket: Socket | null = null
  private generation = 0
  private userId: string | null = null
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private hasConnected = false
  private readonly qc: QueryClient

  constructor(qc: QueryClient) {
    this.qc = qc
  }

  /** Abre (ou reabre) a conexão para a sessão informada. */
  async connect(session: { token: string | null; userId: string | null }): Promise<void> {
    const generation = ++this.generation
    this.teardown()
    this.userId = session.userId
    this.seen.clear()
    this.versions.clear()
    this.hasConnected = false
    setConnectionStatus('connecting')

    const { io } = await import('socket.io-client')
    if (generation !== this.generation) return // outra sessão assumiu enquanto carregava

    const socket = io(env.socketUrl ?? window.location.origin, {
      path: env.socketPath,
      transports: ['websocket'],
      auth: session.token ? { token: session.token } : {},
      reconnection: true,
      reconnectionDelay: 400,
      reconnectionDelayMax: 3000,
      randomizationFactor: 0.2,
      timeout: 5000,
    })
    this.socket = socket

    socket.on('connect', () => {
      if (generation !== this.generation) return
      setConnectionStatus('connected')
      if (this.hasConnected) this.reconcile()
      this.hasConnected = true
    })
    socket.on('disconnect', (reason) => {
      if (generation !== this.generation) return
      setConnectionStatus(reason === 'io client disconnect' ? 'idle' : 'reconnecting')
    })
    socket.on('connect_error', () => {
      if (generation !== this.generation) return
      setConnectionStatus(this.hasConnected ? 'reconnecting' : 'offline')
    })
    socket.io.on('reconnect_attempt', () => {
      if (generation === this.generation) setConnectionStatus('reconnecting')
    })

    socket.on('nft.updated', (payload: unknown) => this.handle(generation, payload, 'nft.updated'))
    socket.on('order.updated', (payload: unknown) => this.handle(generation, payload, 'order.updated'))
  }

  /** Encerra a conexão atual e libera listeners (logout, troca de usuário, desmontagem). */
  disconnect(): void {
    this.generation++
    this.teardown()
    setConnectionStatus('idle')
  }

  private teardown() {
    if (!this.socket) return
    this.socket.removeAllListeners()
    this.socket.io.removeAllListeners()
    this.socket.disconnect()
    this.socket = null
  }

  /** Força uma reconexão (usado pelo indicador de status). */
  reconnectNow(): void {
    if (this.socket && !this.socket.connected) this.socket.connect()
  }

  private handle(generation: number, payload: unknown, type: RealtimeEvent['type']) {
    if (generation !== this.generation) return // evento de uma sessão anterior
    const parsed = type === 'nft.updated' ? nftUpdatedEventSchema.safeParse(payload) : orderUpdatedEventSchema.safeParse(payload)
    if (!parsed.success) return
    const event = parsed.data
    // duplicata
    if (this.seen.has(event.id)) return
    this.seen.add(event.id)
    if (this.seen.size > SEEN_LIMIT) this.seen.delete(this.seen.values().next().value as string)
    // ordenação por versão do recurso
    const resourceKey = `${event.resource.type}:${event.resource.id}`
    const known = this.versions.get(resourceKey) ?? 0
    if (event.version <= known) return
    this.versions.set(resourceKey, event.version)

    if (event.type === 'nft.updated') {
      if (applyNftUpdated(this.qc, event)) emitNotice({ kind: 'nft', event })
    } else if (applyOrderUpdated(this.qc, event, this.userId)) {
      emitNotice({ kind: 'order', event })
    }
  }

  /** Após reconectar: eventos podem ter sido perdidos → revalida os recursos ativos via REST. */
  private reconcile() {
    void this.qc.invalidateQueries({ queryKey: qk.cartAll })
    void this.qc.invalidateQueries({ queryKey: qk.nfts, refetchType: 'active' })
    if (this.userId) {
      void this.qc.invalidateQueries({ queryKey: qk.ordersAll(this.userId) })
      void this.qc.invalidateQueries({ queryKey: qk.orders(this.userId) })
    }
  }
}
