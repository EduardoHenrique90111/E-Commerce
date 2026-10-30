import { COLLECTIONS, NETWORKS, SORTS, type CatalogQuery, type CatalogSort, type CollectionSlug, type Network } from '@/api/contracts'
import { ethToMicro } from '@/lib/format'

/**
 * Parâmetros de busca da home (URL ↔ estado). Mantidos na URL para que filtros, ordenação e
 * paginação sejam compartilháveis e restaurados pelo histórico do navegador.
 *   ?q=ape&col=musica,arte-3d&net=polygon&min=0.5&max=3&sort=price-asc&page=2
 */
export interface CatalogSearch {
  q?: string
  col?: string
  net?: string
  min?: number
  max?: number
  sort?: CatalogSort
  page?: number
  focus?: number
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined
  if (typeof v === 'number') return String(v)
  return undefined
}

function asNumber(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function asList<T extends string>(v: unknown, allowed: readonly T[]): string | undefined {
  const raw = asString(v)
  if (!raw) return undefined
  const list = raw.split(',').filter((x): x is T => (allowed as readonly string[]).includes(x))
  return list.length ? Array.from(new Set(list)).join(',') : undefined
}

export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const sort = asString(raw.sort)
  const page = asNumber(raw.page)
  const search: CatalogSearch = {
    q: asString(raw.q)?.slice(0, 80),
    col: asList<CollectionSlug>(raw.col, COLLECTIONS),
    net: asList<Network>(raw.net, NETWORKS),
    min: asNumber(raw.min),
    max: asNumber(raw.max),
    sort: sort && (SORTS as readonly string[]).includes(sort) && sort !== 'relevance' ? (sort as CatalogSort) : undefined,
    page: page && page > 1 ? Math.floor(page) : undefined,
    focus: asNumber(raw.focus) ? 1 : undefined,
  }
  // remove chaves indefinidas para manter a URL limpa
  return Object.fromEntries(Object.entries(search).filter(([, v]) => v !== undefined)) as CatalogSearch
}

export function toCatalogQuery(search: CatalogSearch): CatalogQuery {
  return {
    q: search.q,
    collections: search.col?.split(',') as CollectionSlug[] | undefined,
    networks: search.net?.split(',') as Network[] | undefined,
    minPrice: search.min !== undefined ? ethToMicro(search.min) : undefined,
    maxPrice: search.max !== undefined ? ethToMicro(search.max) : undefined,
    sort: search.sort ?? 'relevance',
    page: search.page ?? 1,
  }
}

export function toggleInList(list: string | undefined, value: string): string | undefined {
  const items = new Set(list?.split(',').filter(Boolean))
  if (items.has(value)) items.delete(value)
  else items.add(value)
  return items.size ? Array.from(items).join(',') : undefined
}

export function hasActiveFilters(s: CatalogSearch): boolean {
  return !!(s.q || s.col || s.net || s.min !== undefined || s.max !== undefined)
}
