import { Link } from '@tanstack/react-router'
import { toApiError } from '@/api/errors'
import { Heart, RefreshCw, TriangleAlert } from '@/components/icons'
import { NftCard, NftCardSkeleton } from '@/components/nft/nft-card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { usePageMeta } from '@/lib/page-meta'
import { useFavorites } from '@/queries/favorites'

export function FavoritesPage() {
  usePageMeta({ title: 'Lista de desejos — Kurio' })
  const favorites = useFavorites()
  // itens removidos de forma otimista somem imediatamente
  const items = favorites.data?.items.filter((i) => favorites.data?.ids.includes(i.id)) ?? []
  return (
    <section aria-labelledby="fav-title" className="flex flex-col gap-4">
      <h1 id="fav-title" className="text-sm font-bold">
        Lista de desejos
      </h1>
      {favorites.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <NftCardSkeleton key={i} />
          ))}
        </div>
      ) : favorites.isError ? (
        <Alert variant="destructive" role="alert">
          <TriangleAlert size={16} />
          <div className="flex flex-col gap-2">
            <AlertDescription>{toApiError(favorites.error).message}</AlertDescription>
            <Button size="sm" variant="outline" onClick={() => void favorites.refetch()}>
              <RefreshCw size={14} /> Tentar novamente
            </Button>
          </div>
        </Alert>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center" data-testid="favorites-empty">
          <Heart size={28} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Você ainda não favoritou nenhum NFT.</p>
          <Button asChild size="sm">
            <Link to="/" hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="favorites-grid">
          {items.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
