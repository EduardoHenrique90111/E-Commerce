/**
 * Servidor Socket.IO simulado.
 *
 * Transporte: o MSW intercepta o construtor global `WebSocket` (não o Service Worker) e o
 * `@mswjs/socket.io-binding` implementa o handshake Engine.IO/Socket.IO sobre a conexão
 * interceptada. O cliente real `socket.io-client` (transporte `websocket`) conversa com este
 * servidor exatamente como faria com um servidor de produção.
 *
 * Limitações (documentadas em ARCHITECTURE.md): apenas o namespace padrão, sem acks, sem
 * transporte long-polling e sem mensagens binárias; o "servidor" vive na própria aba.
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { RealtimeEvent } from '@/api/contracts'
import { getConfig } from './config'
import { onRealtimeEvent, publish } from './events'
import { resolveSession } from './http'

interface ServerConnection {
  id: string
  userId: string | null
  close: (code?: number, reason?: string) => void
  emit: (event: string, payload: unknown) => void
}

const connections = new Map<string, ServerConnection>()
let connectionSeq = 0
type ConnectionListener = (snapshot: Array<{ id: string; userId: string | null }>) => void
const connectionListeners = new Set<ConnectionListener>()

function notifyConnections() {
  const snapshot = [...connections.values()].map((c) => ({ id: c.id, userId: c.userId }))
  for (const l of connectionListeners) l(snapshot)
}

export function onConnectionsChange(listener: ConnectionListener): () => void {
  connectionListeners.add(listener)
  return () => connectionListeners.delete(listener)
}

export function realtimeUrl(): string {
  const configured = import.meta.env.VITE_SOCKET_URL as string | undefined
  const origin = configured ? new URL(configured, window.location.href).origin : window.location.origin
  // O MSW remove o prefixo /socket.io/ das URLs Socket.IO: o link aponta para a origem.
  return origin.replace(/^http/, 'ws')
}

export function createRealtimeHandler() {
  const link = ws.link(realtimeUrl())

  return link.addEventListener('connection', (connection) => {
    const config = getConfig()
    if (!config.realtimeAvailable) {
      // servidor indisponível: fecha a conexão; o cliente tentará reconectar com backoff
      queueMicrotask(() => connection.client.close(4503, 'Servidor de tempo real indisponível (simulação)'))
      return
    }

    // O binding tipa a conexão com a versão de @mswjs/interceptors que ele próprio declara;
    // em tempo de execução os objetos client/server do MSW são compatíveis.
    const io = toSocketIo(connection as unknown as Parameters<typeof toSocketIo>[0])
    const id = `sock_${++connectionSeq}`
    const conn: ServerConnection = {
      id,
      userId: null,
      close: (code = 4000, reason = 'Conexão encerrada pelo servidor (simulação)') => connection.client.close(code, reason),
      emit: (event, payload) => io.client.emit(event, payload),
    }
    connections.set(id, conn)
    notifyConnections()

    // Pacote CONNECT do Socket.IO ("40{...auth}") traz o token da sessão.
    connection.client.addEventListener('message', (event) => {
      if (typeof event.data !== 'string' || !event.data.startsWith('40')) return
      let auth: { token?: string } = {}
      try {
        auth = event.data.length > 2 ? (JSON.parse(event.data.slice(2)) as { token?: string }) : {}
      } catch {
        auth = {}
      }
      const resolved = resolveSession(auth.token ?? null)
      conn.userId = 'session' in resolved ? resolved.session.userId : null
      notifyConnections()
    })

    // Heartbeat Engine.IO (pacote "2" = ping); o cliente responde "3" (pong).
    const heartbeat = setInterval(() => {
      try {
        connection.client.send('2')
      } catch {
        clearInterval(heartbeat)
      }
    }, config.heartbeatMs)

    connection.client.addEventListener('close', () => {
      clearInterval(heartbeat)
      connections.delete(id)
      notifyConnections()
    })
  })
}

/** Entrega cada evento publicado pelo domínio aos clientes autorizados. */
function deliver(event: RealtimeEvent) {
  for (const conn of connections.values()) {
    if (event.type === 'order.updated' && conn.userId !== event.userId) continue
    conn.emit(event.type, event)
  }
}

let started = false
export function startRealtimeDelivery(): void {
  if (started) return
  started = true
  onRealtimeEvent(deliver)
}

/* ---------------- Controles usados pelo painel e pelos testes ---------------- */

export function disconnectAll(): number {
  const count = connections.size
  for (const conn of [...connections.values()]) conn.close()
  return count
}

export function listConnections(): Array<{ id: string; userId: string | null }> {
  return [...connections.values()].map((c) => ({ id: c.id, userId: c.userId }))
}

/** Reenvia um evento já publicado (simula duplicata entregue pelo servidor). */
export function replayEvent(event: RealtimeEvent): void {
  deliver(event)
}

/** Publica um evento arbitrário (ex.: versão antiga) pelo mesmo canal Socket.IO. */
export function injectEvent(event: RealtimeEvent): void {
  publish(event)
}
