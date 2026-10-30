import { http, HttpResponse } from 'msw'
import { COLLECTIONS, NETWORKS, SORTS, type CatalogQuery, type CollectionSlug, type Network, type CatalogSort } from '@/api/contracts'
import { getDb } from '../db'
import { listCatalog, relatedNfts, toDetail } from '../domain'
import { apiError, simulateNetwork } from '../http'

function parseList<T extends string>(value: string | null, allowed: readonly T[]): T[] | undefined {
  if (!value) return undefined
  const items = value.split(',').filter((v): v is T => (allowed as readonly string[]).includes(v))
  return items.length ? items : undefined
}

function parseIntParam(value: string | null): number | undefined {
  if (value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
}

export const catalogHandlers = [
  http.get('/api/nfts', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const url = new URL(request.url)
    const sort = url.searchParams.get('sort')
    const query: CatalogQuery = {
      q: url.searchParams.get('q') ?? undefined,
      collections: parseList<CollectionSlug>(url.searchParams.get('collection'), COLLECTIONS),
      networks: parseList<Network>(url.searchParams.get('network'), NETWORKS),
      minPrice: parseIntParam(url.searchParams.get('minPrice')),
      maxPrice: parseIntParam(url.searchParams.get('maxPrice')),
      sort: (SORTS as readonly string[]).includes(sort ?? '') ? (sort as CatalogSort) : 'relevance',
      page: parseIntParam(url.searchParams.get('page')) || 1,
      pageSize: parseIntParam(url.searchParams.get('pageSize')),
    }
    if (query.minPrice !== undefined && query.maxPrice !== undefined && query.minPrice > query.maxPrice) {
      return apiError('VALIDATION_ERROR', 'O preço mínimo deve ser menor que o máximo.', { fieldErrors: { minPrice: 'Faixa de preço inválida.' } })
    }
    return HttpResponse.json(listCatalog(query))
  }),

  http.get('/api/nfts/:id', async ({ request, params }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const nft = getDb().nfts[String(params.id)]
    if (!nft) return apiError('NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json(toDetail(nft))
  }),

  http.get('/api/nfts/:id/related', async ({ request, params }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const id = String(params.id)
    if (!getDb().nfts[id]) return apiError('NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json({ items: relatedNfts(id) })
  }),
]
