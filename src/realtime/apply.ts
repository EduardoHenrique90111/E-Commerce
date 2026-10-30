/**
 * Aplicação dos eventos Socket.IO no cache do TanStack Query.
 *
 * Regras:
 *  - versão do evento ≤ versão já conhecida (cache ou evento anterior) → ignorado (sem regressão);
 *  - pedidos confirmados/recusados são terminais: nunca voltam a "pendente";
 *  - efeitos colaterais (invalidações, avisos) só acontecem quando o evento foi aplicado.
 */
import type { QueryClient } from '@tanstack/react-query'
import type { CatalogResponse, FavoritesResponse, NftDetail, NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/api/contracts'
import { qk } from '@/queries/keys'

export function applyNftUpdated(qc: QueryClient, event: NftUpdatedEvent): boolean {
  const { nftId } = event.data
  let applied = false

  const detail = qc.getQueryData<NftDetail>(qk.nft(nftId))
  if (detail && detail.version >= event.version) return false
  if (detail) {
    qc.setQueryData<NftDetail>(qk.nft(nftId), {
      ...detail,
      version: event.version,
      priceFrom: event.data.priceFrom,
      available: event.data.available,
      editions: detail.editions.map((ed) => {
        const next = event.data.editions.find((e) => e.id === ed.id)
        return next ? { ...ed, price: next.price, available: next.available } : ed
      }),
    })
    applied = true
  }

  const patchSummary = <T extends { id: string; version: number; priceFrom: number; available: number }>(item: T): T =>
    item.id === nftId && item.version < event.version
      ? { ...item, version: event.version, priceFrom: event.data.priceFrom, available: event.data.available }
      : item

  qc.setQueriesData<CatalogResponse>({ queryKey: qk.catalogAll }, (data) => {
    if (!data?.items.some((i) => i.id === nftId && i.version < event.version)) return data
    applied = true
    return { ...data, items: data.items.map(patchSummary) }
  })
  qc.setQueriesData<{ items: CatalogResponse['items'] }>({ queryKey: ['nfts', 'related'] }, (data) => {
    if (!data?.items.some((i) => i.id === nftId && i.version < event.version)) return data
    applied = true
    return { ...data, items: data.items.map(patchSummary) }
  })
  qc.setQueriesData<FavoritesResponse>({ predicate: (q) => q.queryKey[0] === 'user' && q.queryKey[2] === 'favorites' }, (data) => {
    if (!data?.items.some((i) => i.id === nftId && i.version < event.version)) return data
    applied = true
    return { ...data, items: data.items.map(patchSummary) }
  })

  // carrinho e cotações são recalculados pelo servidor: refaz a consulta se o NFT estiver no carrinho
  const inCart = qc
    .getQueriesData<{ items: Array<{ nftId: string; nftVersion: number }> }>({ queryKey: qk.cartAll })
    .some(([key, data]) => key.length === 2 && data?.items.some((i) => i.nftId === nftId && i.nftVersion < event.version))
  if (inCart) {
    applied = true
    void qc.invalidateQueries({ queryKey: qk.cartAll })
  }
  return applied
}

const TERMINAL = new Set(['confirmed', 'rejected'])

export function applyOrderUpdated(qc: QueryClient, event: OrderUpdatedEvent, currentUserId: string | null): boolean {
  // isolamento: eventos de outro usuário (ou de uma sessão anterior) são descartados
  if (!currentUserId || event.userId !== currentUserId) return false
  const key = qk.order(currentUserId, event.data.orderId)
  const current = qc.getQueryData<Order>(key)
  if (current) {
    if (current.version >= event.version) return false
    if (TERMINAL.has(current.status)) return false
    qc.setQueryData<Order>(key, {
      ...current,
      status: event.data.status,
      version: event.version,
      failureReason: event.data.failureReason,
      transaction: event.data.transaction,
      updatedAt: event.occurredAt,
      settledAt: event.data.status === 'pending' ? null : event.occurredAt,
    })
  }
  // garante o snapshot completo do recibo vindo da API REST
  void qc.invalidateQueries({ queryKey: key })
  void qc.invalidateQueries({ queryKey: qk.orders(currentUserId) })
  if (event.data.status === 'confirmed') void qc.invalidateQueries({ queryKey: qk.cartAll })
  return true
}
