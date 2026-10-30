import { useDeferredValue, useRef } from 'react'
import { ChevronLeft, ChevronRight } from '@/components/icons'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Button } from '@/components/ui/button'
import { useRelated } from '@/queries/catalog'

/** Carrossel horizontal acessível ("Mais desta coleção" / "Colecionadores também viram"). */
export function RelatedCarousel({ nftId, title }: { nftId: string; title: string }) {
  const related = useRelated(nftId)
  const items = useDeferredValue(related.data?.items)
  const scroller = useRef<HTMLUListElement>(null)
  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' })
  const headingId = `related-${nftId}`
  return (
    <section className="mt-12" aria-labelledby={headingId}>
      <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
        <h2 id={headingId} className="text-sm font-bold text-primary">
          {title}
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => scrollBy(-1)} aria-label="Itens anteriores">
            <ChevronLeft size={16} />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => scrollBy(1)} aria-label="Próximos itens">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      <ul ref={scroller} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]" tabIndex={-1}>
        {items === undefined && !related.isError
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[calc(20%-0.6rem)]">
                <NftCardSkeleton />
              </li>
            ))
          : items?.map((nft) => (
              <li key={nft.id} className="w-[44%] shrink-0 snap-start sm:w-[30%] lg:w-[calc(20%-0.6rem)]">
                <NftCard nft={nft} />
              </li>
            ))}
      </ul>
    </section>
  )
}
