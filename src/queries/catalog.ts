import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import type { CatalogQuery } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { qk } from './keys'

export const catalogQueryOptions = (query: CatalogQuery) =>
  queryOptions({
    queryKey: qk.catalog(query),
    // o AbortSignal cancela a requisição quando os parâmetros mudam (respostas obsoletas são descartadas)
    queryFn: ({ signal }) => api.nfts.list(query, { signal }),
    placeholderData: keepPreviousData,
  })

export function useCatalog(query: CatalogQuery) {
  return useQuery(catalogQueryOptions(query))
}

export const nftQueryOptions = (id: string) =>
  queryOptions({
    queryKey: qk.nft(id),
    queryFn: ({ signal }) => api.nfts.detail(id, { signal }),
    retry: (count, error) => {
      const e = toApiError(error)
      return e.isTransient && e.kind !== 'canceled' && count < 2
    },
  })

export function useNft(id: string) {
  return useQuery(nftQueryOptions(id))
}

export const relatedQueryOptions = (id: string) =>
  queryOptions({ queryKey: qk.related(id), queryFn: ({ signal }) => api.nfts.related(id, { signal }), staleTime: 60_000 })

export function useRelated(id: string) {
  return useQuery(relatedQueryOptions(id))
}

/** Destaques da home: os 4 mais relevantes. */
export function useFeatured() {
  return useQuery({
    queryKey: qk.catalog({ sort: 'popular', pageSize: 4 }),
    queryFn: ({ signal }) => api.nfts.list({ sort: 'popular', pageSize: 4 }, { signal }),
    staleTime: 60_000,
  })
}
