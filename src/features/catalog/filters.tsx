import { useEffect, useState } from 'react'
import type { CatalogResponse, CollectionSlug, Network } from '@/api/contracts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { COLLECTION_LABEL, NETWORK_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toggleInList, type CatalogSearch } from './search'

interface Props {
  search: CatalogSearch
  facets: CatalogResponse['facets'] | undefined
  onChange: (patch: Partial<CatalogSearch>) => void
  idPrefix: string
}

function FacetButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        active && 'bg-primary/15 font-semibold text-primary',
      )}
    >
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className={cn('size-3 rounded-[3px] border border-current', active && 'bg-current')} />
        {label}
      </span>
      <span className="tabular-nums">({count})</span>
    </button>
  )
}

export function FiltersPanel({ search, facets, onChange, idPrefix }: Props) {
  const bounds = facets?.priceRange ?? { min: 0, max: 0 }
  const maxEth = Math.ceil(bounds.max / 1_000_000 / 0.5) * 0.5 || 15
  const [range, setRange] = useState<[number, number]>([search.min ?? 0, search.max ?? maxEth])
  useEffect(() => setRange([search.min ?? 0, search.max ?? maxEth]), [search.min, search.max, maxEth])
  const selectedCollections = new Set(search.col?.split(','))
  const selectedNetworks = new Set(search.net?.split(','))

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={`${idPrefix}-collections`}>
        <h3 id={`${idPrefix}-collections`} className="mb-2 text-xs font-bold">
          Coleções
        </h3>
        {facets ? (
          <ul className="flex flex-col gap-0.5">
            {facets.collections.map((f) => (
              <li key={f.value}>
                <FacetButton
                  label={COLLECTION_LABEL[f.value as CollectionSlug]}
                  count={f.count}
                  active={selectedCollections.has(f.value)}
                  onClick={() => onChange({ col: toggleInList(search.col, f.value), page: undefined })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby={`${idPrefix}-price`}>
        <h3 id={`${idPrefix}-price`} className="mb-3 text-xs font-bold">
          Faixa de preço
        </h3>
        <Slider
          min={0}
          max={maxEth}
          step={0.05}
          minStepsBetweenThumbs={1}
          value={range}
          onValueChange={(v) => setRange([v[0], v[1]])}
          thumbLabels={['Preço mínimo em ETH', 'Preço máximo em ETH']}
          aria-label="Faixa de preço"
        />
        <p className="mt-3 text-[0.6875rem] text-muted-foreground" aria-live="polite">
          Preço: {range[0].toFixed(2)} — {range[1].toFixed(2)} ETH
        </p>
        <Button
          size="sm"
          className="mt-2"
          onClick={() =>
            onChange({
              min: range[0] > 0 ? Number(range[0].toFixed(2)) : undefined,
              max: range[1] < maxEth ? Number(range[1].toFixed(2)) : undefined,
              page: undefined,
            })
          }
        >
          Aplicar
        </Button>
      </section>

      <section aria-labelledby={`${idPrefix}-network`}>
        <h3 id={`${idPrefix}-network`} className="mb-2 text-xs font-bold">
          Rede
        </h3>
        {facets ? (
          <ul className="flex flex-col gap-0.5">
            {facets.networks.map((f) => (
              <li key={f.value}>
                <FacetButton
                  label={NETWORK_LABEL[f.value as Network]}
                  count={f.count}
                  active={selectedNetworks.has(f.value)}
                  onClick={() => onChange({ net: toggleInList(search.net, f.value), page: undefined })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
