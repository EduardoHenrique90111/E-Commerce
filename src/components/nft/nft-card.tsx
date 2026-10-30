import { Link } from '@tanstack/react-router'
import type { NftSummary } from '@/api/contracts'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { COLLECTION_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FavoriteButton } from './favorite-button'
import { NftImage } from './nft-image'
import { Price } from './price'

export const CARD_SIZES = '(min-width: 1024px) 240px, (min-width: 768px) 30vw, 45vw'

export function NftCard({ nft, className, priority }: { nft: NftSummary; className?: string; priority?: boolean }) {
  const soldOut = nft.available === 0
  return (
    <article className={cn('group relative flex flex-col gap-2 rounded-lg bg-surface p-2.5 transition-colors hover:bg-surface-2', className)} data-testid="nft-card" data-nft-id={nft.id}>
      <div className="relative">
        <NftImage image={nft.image} sizes={CARD_SIZES} priority={priority} />
        {nft.badge || soldOut ? (
          <Badge className="absolute top-2 left-2" variant={soldOut ? 'muted' : 'default'}>
            {soldOut ? 'Esgotado' : nft.badge === 'hot' ? 'Hot' : 'Novo'}
          </Badge>
        ) : null}
        <FavoriteButton nftId={nft.id} name={nft.name} variant="overlay" className="absolute top-2 right-2 z-10 size-8" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
        <h3 className="truncate text-xs font-semibold text-foreground">
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-ring">
            {nft.name}
          </Link>
        </h3>
        <p className="sr-only">Coleção {COLLECTION_LABEL[nft.collection]}</p>
        <Price value={nft.priceFrom} className="text-xs" />
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface p-2.5" data-testid="nft-card-skeleton">
      <Skeleton className="aspect-square w-full" />
      <Skeleton className="h-3.5 w-3/4" />
      <Skeleton className="h-3.5 w-1/3" />
    </div>
  )
}
