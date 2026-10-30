import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Funnel, RefreshCw, Search, TriangleAlert, X } from '@/components/icons'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { NftImage } from '@/components/nft/nft-image'
import { Price } from '@/components/nft/price'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SORTS, type CatalogSort, type CollectionSlug, type Network } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { useCatalog, useFeatured } from '@/queries/catalog'
import { COLLECTION_LABEL, NETWORK_LABEL, SORT_LABEL } from '@/lib/format'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { FiltersPanel } from './filters'
import { hasActiveFilters, toCatalogQuery, type CatalogSearch } from './search'

interface Props {
  search: CatalogSearch
  onChange: (patch: Partial<CatalogSearch>, options?: { replace?: boolean }) => void
  interactive?: boolean
}

function SearchBox({ value, onCommit, autoFocus }: { value: string; onCommit: (q: string | undefined) => void; autoFocus?: boolean }) {
  const [text, setText] = useState(value)
  const committed = useRef(value)
  const commitRef = useRef(onCommit)
  commitRef.current = onCommit
  useEffect(() => {
    setText(value)
    committed.current = value
  }, [value])
  // busca incremental com debounce (cada termo confirmado vira uma entrada no histórico)
  useEffect(() => {
    if (text === committed.current) return
    const t = window.setTimeout(() => {
      committed.current = text
      commitRef.current(text.trim() || undefined)
    }, 350)
    return () => window.clearTimeout(t)
  }, [text])
  return (
    <form
      role="search"
      className="relative w-full md:max-w-xs"
      onSubmit={(e) => {
        e.preventDefault()
        committed.current = text
        onCommit(text.trim() || undefined)
      }}
    >
      <label htmlFor="catalog-search" className="sr-only">
        Buscar NFTs, criadores ou atributos
      </label>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle-foreground" />
      <Input
        id="catalog-search"
        type="search"
        placeholder="Explorar coleções…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-9 pl-9 text-xs"
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
      />
    </form>
  )
}

function Pagination({ page, totalPages, search }: { page: number; totalPages: number; search: CatalogSearch }) {
  if (totalPages <= 1) return null
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const linkCls = 'inline-flex size-8 items-center justify-center rounded-md text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
  const to = (p: number) => ({ ...search, page: p > 1 ? p : undefined, focus: undefined })
  return (
    <nav aria-label="Paginação do catálogo" className="mt-8 flex justify-end">
      <ul className="flex items-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link to="/" search={to(page - 1)} hash="catalogo" className={cn(linkCls, 'bg-surface-2 hover:bg-surface-3')} aria-label="Página anterior">
              <ChevronLeft size={16} />
            </Link>
          ) : null}
        </li>
        {pages.map((p) => (
          <li key={p}>
            <Link
              to="/"
              search={to(p)}
              hash="catalogo"
              className={cn(linkCls, p === page ? 'bg-primary text-primary-foreground' : 'bg-surface-2 text-muted-foreground hover:bg-surface-3 hover:text-foreground')}
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Link>
          </li>
        ))}
        <li>
          {page < totalPages ? (
            <Link to="/" search={to(page + 1)} hash="catalogo" className={cn(linkCls, 'bg-surface-2 hover:bg-surface-3')} aria-label="Próxima página">
              <ChevronRight size={16} />
            </Link>
          ) : null}
        </li>
      </ul>
    </nav>
  )
}

function FeaturedSidebarCard() {
  const featured = useFeatured()
  const nft = featured.data?.items[1] ?? featured.data?.items[0]
  return (
    <aside aria-labelledby="featured-title" className="hidden rounded-lg bg-surface p-3 lg:block">
      <h2 id="featured-title" className="mb-3 text-center text-sm leading-snug font-extrabold text-primary uppercase">
        NFT em destaque
        <span className="block text-xs text-foreground">Oferta limitada</span>
      </h2>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <NftImage image={nft.image} sizes="220px" />
          <span className="mt-2 block truncate text-xs font-semibold">{nft.name}</span>
          <Price value={nft.priceFrom} className="text-xs" />
        </Link>
      ) : (
        <div className="skeleton aspect-square w-full" />
      )}
    </aside>
  )
}

export function CatalogSection({ search, onChange, interactive = true }: Props) {
  const query = toCatalogQuery(search)
  const catalog = useCatalog(query)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  // A grade é renderizada a partir do valor adiado: o React a monta em segundo plano (fatiada),
  // sem uma tarefa longa no thread principal quando a resposta chega. O skeleton permanece até lá.
  const data = useDeferredValue(catalog.data)
  const page = query.page ?? 1
  const activeChips = [
    ...(search.q ? [{ key: 'q', label: `“${search.q}”`, clear: { q: undefined } }] : []),
    ...(search.col?.split(',') ?? []).map((c) => ({ key: `col-${c}`, label: COLLECTION_LABEL[c as CollectionSlug], clear: { col: search.col!.split(',').filter((x) => x !== c).join(',') || undefined } })),
    ...(search.net?.split(',') ?? []).map((n) => ({ key: `net-${n}`, label: NETWORK_LABEL[n as Network], clear: { net: search.net!.split(',').filter((x) => x !== n).join(',') || undefined } })),
    ...(search.min !== undefined || search.max !== undefined
      ? [{ key: 'price', label: `${(search.min ?? 0).toFixed(2)}–${search.max !== undefined ? search.max.toFixed(2) : '∞'} ETH`, clear: { min: undefined, max: undefined } }]
      : []),
  ]
  const isRefreshing = catalog.isFetching && !catalog.isPending
  const showSkeleton = (data === undefined && !catalog.isError) || (catalog.isPlaceholderData && catalog.isFetching && !data?.items.length)

  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="container-kurio scroll-mt-20 pt-10 md:pt-14">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* barra lateral só é montada no desktop; abaixo de 1024 px os filtros ficam no drawer */}
        {isDesktop ? (
          <div className="flex flex-col gap-6">
            <div className="rounded-lg bg-surface p-4">
              <FiltersPanel search={search} facets={data?.facets} onChange={onChange} idPrefix="side" />
            </div>
            <FeaturedSidebarCard />
          </div>
        ) : null}

        <div className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-border pb-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div role="group" aria-label="Atalhos de listagem" className="flex gap-4 text-xs">
                {(
                  [
                    ['relevance', 'Todos os NFTs'],
                    ['newest', 'Novidades'],
                  ] as const
                ).map(([value, label]) => {
                  const active = (search.sort ?? 'relevance') === value
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ sort: value === 'relevance' ? undefined : value, page: undefined })}
                      className={cn('border-b-2 border-transparent pb-1 font-semibold whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', active && 'border-primary text-primary')}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto">
              <SearchBox value={search.q ?? ''} onCommit={(q) => onChange({ q, page: undefined })} autoFocus={interactive && !!search.focus} />
              <div className="flex flex-wrap items-center gap-2">
                <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 lg:hidden" data-testid="open-filters">
                      <Funnel size={14} /> Filtros
                      {activeChips.length ? <span className="rounded-full bg-primary px-1.5 text-[0.625rem] text-primary-foreground">{activeChips.length}</span> : null}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" aria-describedby="filters-desc">
                    <SheetTitle>Filtros</SheetTitle>
                    <SheetDescription id="filters-desc">Refine por coleção, faixa de preço e rede.</SheetDescription>
                    <FiltersPanel search={search} facets={data?.facets} onChange={onChange} idPrefix="sheet" />
                    <Button className="mt-auto" onClick={() => setFiltersOpen(false)}>
                      Ver {data?.total ?? 0} resultados
                    </Button>
                  </SheetContent>
                </Sheet>
                <label htmlFor="catalog-sort" className="text-[0.6875rem] whitespace-nowrap text-muted-foreground">
                  Ordenar por:
                </label>
                <div className="min-w-36 flex-1 sm:flex-none">
                <NativeSelect
                  id="catalog-sort"
                  className="h-9 w-full text-xs sm:w-40"
                  value={search.sort ?? 'relevance'}
                  onChange={(e) => onChange({ sort: e.target.value === 'relevance' ? undefined : (e.target.value as CatalogSort), page: undefined })}
                >
                  {SORTS.map((s) => (
                    <option key={s} value={s}>
                      {SORT_LABEL[s]}
                    </option>
                  ))}
                </NativeSelect>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-9 flex-wrap items-center gap-2 py-3">
            <p className="text-[0.6875rem] text-muted-foreground" role="status" aria-live="polite" data-testid="results-count">
              {data ? `${data.total} ${data.total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}` : catalog.isError ? '' : 'Carregando NFTs…'}
            </p>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => onChange({ ...chip.clear, page: undefined })}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[0.6875rem] text-foreground hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Remover filtro ${chip.label}`}
              >
                {chip.label} <X size={12} />
              </button>
            ))}
            {hasActiveFilters(search) ? (
              <Button variant="link" size="sm" className="text-[0.6875rem]" onClick={() => onChange({ q: undefined, col: undefined, net: undefined, min: undefined, max: undefined, page: undefined })}>
                Limpar filtros
              </Button>
            ) : null}
            {isRefreshing ? (
              <span className="ml-auto inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground" data-testid="catalog-refreshing">
                <RefreshCw size={12} className="animate-spin" /> Atualizando…
              </span>
            ) : null}
          </div>

          {catalog.isError && !data ? (
            <Alert variant="destructive" role="alert" data-testid="catalog-error">
              <TriangleAlert size={16} />
              <div className="flex flex-1 flex-col gap-2">
                <AlertTitle>Não foi possível carregar o catálogo</AlertTitle>
                <AlertDescription>{toApiError(catalog.error).message}</AlertDescription>
                <div>
                  <Button size="sm" variant="outline" onClick={() => void catalog.refetch()} loading={catalog.isFetching}>
                    <RefreshCw size={14} /> Tentar novamente
                  </Button>
                </div>
              </div>
            </Alert>
          ) : showSkeleton ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4" aria-busy="true" aria-label="Carregando NFTs">
              {Array.from({ length: 12 }, (_, i) => (
                <NftCardSkeleton key={i} />
              ))}
            </div>
          ) : data && data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center" data-testid="catalog-empty">
              <p className="text-sm font-bold">Nenhum NFT encontrado</p>
              <p className="max-w-sm text-xs text-muted-foreground">Ajuste a busca ou remova alguns filtros para ver mais resultados.</p>
              {hasActiveFilters(search) ? (
                <Button size="sm" variant="outline" onClick={() => onChange({ q: undefined, col: undefined, net: undefined, min: undefined, max: undefined, page: undefined })}>
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          ) : data ? (
            <>
              {catalog.isError ? (
                <Alert variant="warning" className="mb-3">
                  <TriangleAlert size={16} />
                  <AlertDescription>Não foi possível atualizar a lista. Exibindo os últimos resultados carregados.</AlertDescription>
                </Alert>
              ) : null}
              <ul className={cn('grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 md:gap-4', isRefreshing && 'opacity-70')} data-testid="catalog-grid" aria-busy={isRefreshing || undefined}>
                {data.items.map((nft, index) => (
                  <li key={nft.id}>
                    {/* a primeira linha fica acima da dobra no mobile: carrega sem lazy e com prioridade alta */}
                    <NftCard nft={nft} priority={page === 1 && index < 2} />
                  </li>
                ))}
              </ul>
              <Pagination page={page} totalPages={data.totalPages} search={search} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  )
}
