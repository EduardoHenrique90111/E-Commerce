/**
 * API de controle da simulação (painel "Simulação" e testes Playwright).
 * Exposta em `window.__KURIO_MOCK__` somente quando os mocks estão ativos.
 *
 * Tudo que ela faz passa pelo "servidor" simulado: alterações de dados viram respostas REST
 * e eventos Socket.IO — a interface nunca é manipulada diretamente.
 */
import type { NftUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import { configForScenario, getConfig, setConfig, updateConfig, type MockConfig, type ScenarioName, SCENARIOS } from './config'
import { getDb, nowIso, persist, resetDb } from './db'
import { priceFrom, resumePendingOrders, settleOrder, totalAvailable, updateNftEditions } from './domain'
import { eventHistory } from './events'
import { resetRequestCounter } from './http'
import { disconnectAll, injectEvent, listConnections, replayEvent } from './realtime'

export interface KurioMockControl {
  scenarios: typeof SCENARIOS
  getConfig: () => MockConfig
  setConfig: (patch: Partial<MockConfig>) => MockConfig
  useScenario: (name: ScenarioName, options?: { reset?: boolean }) => MockConfig
  /** Restaura dados e configuração do cenário ativo para o estado inicial conhecido. */
  reset: (options?: { keepScenario?: boolean }) => void
  nft: {
    get: (nftId: string) => { priceFrom: number; available: number; version: number; editions: Array<{ id: string; price: number; available: number }> } | null
    setPrice: (nftId: string, editionId: string, price: number) => void
    setAvailable: (nftId: string, editionId: string, available: number) => void
    bumpPrice: (nftId: string, percent?: number) => void
  }
  cart: {
    /** Primeiro item do carrinho do usuário (ou visitante) informado. */
    firstLine: (ownerKey: string) => { nftId: string; editionId: string; quantity: number } | null
  }
  orders: {
    list: () => Array<{ id: string; number: string; status: string; userId: string; version: number }>
    settle: (orderId: string, outcome: 'confirmed' | 'rejected') => void
    settleAllPending: (outcome: 'confirmed' | 'rejected') => number
  }
  session: {
    /** Expira imediatamente todas as sessões ativas (ou a do token informado). */
    expire: (token?: string) => number
  }
  wallet: {
    /** Desconecta a carteira ativa do usuário (simula desconexão na extensão). */
    disconnect: (userId: string) => void
  }
  realtime: {
    connections: () => Array<{ id: string; userId: string | null }>
    disconnectAll: () => number
    setAvailable: (available: boolean) => void
    events: () => readonly RealtimeEvent[]
    /** Reentrega o último evento (ou o evento informado) — duplicata. */
    replay: (eventId?: string) => boolean
    /** Envia um `nft.updated` com versão antiga para o NFT. */
    emitStale: (nftId: string) => boolean
  }
}

export function createControl(): KurioMockControl {
  return {
    scenarios: SCENARIOS,
    getConfig,
    setConfig: (patch) => updateConfig(patch),
    useScenario: (name, options) => {
      const next = configForScenario(name)
      setConfig(next)
      if (options?.reset) resetAll()
      return next
    },
    reset: (options) => {
      if (!options?.keepScenario) setConfig(configForScenario(getConfig().scenario))
      resetAll()
    },
    nft: {
      get: (nftId) => {
        const nft = getDb().nfts[nftId]
        if (!nft) return null
        return { priceFrom: priceFrom(nft), available: totalAvailable(nft), version: nft.version, editions: nft.editions.map((e) => ({ id: e.id, price: e.price, available: e.available })) }
      },
      setPrice: (nftId, editionId, price) => void updateNftEditions(nftId, [{ editionId, price }]),
      setAvailable: (nftId, editionId, available) => void updateNftEditions(nftId, [{ editionId, available }]),
      bumpPrice: (nftId, percent = 10) => {
        const nft = getDb().nfts[nftId]
        if (!nft) return
        updateNftEditions(
          nftId,
          nft.editions.map((e) => ({ editionId: e.id, price: Math.round((e.price * (100 + percent)) / 100) })),
        )
      },
    },
    cart: {
      firstLine: (ownerKey) => {
        const line = getDb().carts[ownerKey]?.lines[0]
        return line ? { nftId: line.nftId, editionId: line.editionId, quantity: line.quantity } : null
      },
    },
    orders: {
      list: () => Object.values(getDb().orders).map((o) => ({ id: o.id, number: o.number, status: o.status, userId: o.userId, version: o.version })),
      settle: (orderId, outcome) => void settleOrder(orderId, outcome),
      settleAllPending: (outcome) => {
        const pending = Object.values(getDb().orders).filter((o) => o.status === 'pending')
        for (const o of pending) settleOrder(o.id, outcome)
        return pending.length
      },
    },
    session: {
      expire: (token) => {
        const db = getDb()
        let count = 0
        const past = new Date(Date.now() - 1000).toISOString()
        for (const s of Object.values(db.sessions)) {
          if (s.revokedAt || (token && s.token !== token)) continue
          if (Date.parse(s.expiresAt) > Date.now()) {
            s.expiresAt = past
            count++
          }
        }
        persist()
        return count
      },
    },
    wallet: {
      disconnect: (userId) => {
        getDb().walletConnections[userId] = null
        persist()
      },
    },
    realtime: {
      connections: listConnections,
      disconnectAll,
      setAvailable: (available) => {
        updateConfig({ realtimeAvailable: available })
        if (!available) disconnectAll()
      },
      events: eventHistory,
      replay: (eventId) => {
        const history = eventHistory()
        const event = eventId ? history.find((e) => e.id === eventId) : history[history.length - 1]
        if (!event) return false
        replayEvent(event)
        return true
      },
      emitStale: (nftId) => {
        const nft = getDb().nfts[nftId]
        if (!nft || nft.version < 2) return false
        const stale: NftUpdatedEvent = {
          id: `evt_stale_${nft.version}_${Date.now()}`,
          type: 'nft.updated',
          resource: { type: 'nft', id: nftId },
          version: nft.version - 1,
          occurredAt: nowIso(),
          data: {
            nftId,
            name: nft.name,
            // valores antigos fictícios (bem abaixo do atual) — não podem ser aplicados
            editions: nft.editions.map((e) => ({ id: e.id, price: Math.max(1, Math.round(e.price * 0.5)), available: e.available })),
            priceFrom: Math.max(1, Math.round(priceFrom(nft) * 0.5)),
            available: totalAvailable(nft),
            reason: 'price',
            previous: { priceFrom: priceFrom(nft), available: totalAvailable(nft) },
          },
        }
        injectEvent(stale)
        return true
      },
    },
  }
}

function resetAll() {
  resetDb()
  resetRequestCounter()
  resumePendingOrders()
  // sessões/estado do cliente ficam inválidos: a interface recarrega para um estado limpo
}
