import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { toast } from 'sonner'
import type { NftDetail } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { Copy, RefreshCw, TriangleAlert } from '@/components/icons'
import { FavoriteButton } from '@/components/nft/favorite-button'
import { NftImage } from '@/components/nft/nft-image'
import { Price } from '@/components/nft/price'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { Stars } from '@/components/nft/stars'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { announce } from '@/lib/announce'
import { COLLECTION_LABEL, NETWORK_LABEL, formatDate, formatEth } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import { cn } from '@/lib/utils'
import { useAddToCart } from '@/queries/cart'
import { useNft } from '@/queries/catalog'
import { NotFoundPage } from '@/features/system/not-found'
import { RelatedCarousel } from './related-carousel'

const MAIN_SIZES = '(min-width: 1024px) 420px, (min-width: 768px) 45vw, 92vw'

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="nft-detail-skeleton" aria-busy="true" aria-label="Carregando NFT">
      <div className="flex gap-3">
        <div className="hidden w-16 flex-col gap-3 md:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
        <Skeleton className="aspect-square flex-1" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-10 w-1/2" />
      </div>
    </div>
  )
}

export function NftDetailPage({ nftId }: { nftId: string }) {
  const nft = useNft(nftId)
  const error = nft.error ? toApiError(nft.error) : null
  usePageMeta(
    nft.data
      ? {
          title: `${nft.data.name} — ${COLLECTION_LABEL[nft.data.collection]} | Kurio`,
          description: `${nft.data.name}: NFT de ${COLLECTION_LABEL[nft.data.collection].toLowerCase()} por ${nft.data.creator.name}, a partir de ${formatEth(nft.data.priceFrom)} na rede ${NETWORK_LABEL[nft.data.network]}. ${nft.data.attributes.join(', ')}.`,
        }
      : { title: 'NFT — Kurio' },
  )

  if (error?.status === 404) return <NotFoundNft />

  return (
    <div className="container-kurio pt-4 md:pt-6">
      <nav aria-label="Trilha de navegação" className="mb-4 text-[0.6875rem] text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/" className="hover:text-primary">
              Início
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/" hash="catalogo" className="hover:text-primary">
              Mercado
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            {nft.data?.name ?? '…'}
          </li>
        </ol>
      </nav>

      {nft.isPending ? (
        <DetailSkeleton />
      ) : error && !nft.data ? (
        <Alert variant="destructive" role="alert">
          <TriangleAlert size={16} />
          <div className="flex flex-col gap-2">
            <AlertTitle>Não foi possível carregar este NFT</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
            <div>
              <Button size="sm" variant="outline" onClick={() => void nft.refetch()} loading={nft.isFetching}>
                <RefreshCw size={14} /> Tentar novamente
              </Button>
            </div>
          </div>
        </Alert>
      ) : nft.data ? (
        <NftDetailContent nft={nft.data} />
      ) : null}

      <RelatedCarousel nftId={nftId} title="Mais desta coleção" />
    </div>
  )
}

function NotFoundNft() {
  return (
    <div data-testid="nft-not-found">
      <NotFoundPage />
    </div>
  )
}

function NftDetailContent({ nft }: { nft: NftDetail }) {
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  const [imageIndex, setImageIndex] = useState(0)
  const firstAvailable = nft.editions.find((e) => e.available > 0) ?? nft.editions[0]
  const [editionId, setEditionId] = useState(firstAvailable.id)
  const edition = nft.editions.find((e) => e.id === editionId) ?? firstAvailable
  const maxQty = Math.max(0, Math.min(edition.available, nft.maxPerOrder))
  const [quantity, setQuantity] = useState(1)
  const soldOut = edition.available === 0

  // mantém a quantidade válida quando preço/disponibilidade mudam em tempo real
  useEffect(() => {
    if (maxQty > 0 && quantity > maxQty) setQuantity(maxQty)
    if (maxQty === 0) setQuantity(1)
  }, [maxQty, quantity])

  const image = nft.gallery[imageIndex] ?? nft.image
  const reviews = useMemo(() => buildReviews(nft), [nft])

  const buy = () => {
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          announce(`${quantity} edição(ões) de ${nft.name} adicionada(s) ao carrinho.`)
          toast.success('Adicionado ao carrinho', { description: `${nft.name} · ${edition.label} × ${quantity}` })
          void navigate({ to: '/carrinho' })
        },
        onError: (err) => {
          const e = toApiError(err)
          toast.error('Não foi possível adicionar ao carrinho', { description: e.message })
          announce(e.message, 'assertive')
        },
      },
    )
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.success('Link copiado')
      announce('Link do NFT copiado para a área de transferência.')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  return (
    <>
      <article className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="nft-detail" aria-labelledby="nft-title">
        <div className="flex flex-col-reverse gap-3 md:flex-row md:items-start">
          <div className="flex gap-2 md:w-16 md:flex-col" role="group" aria-label="Galeria de imagens">
            {nft.gallery.map((img, i) => (
              <button
                key={img.base + i}
                type="button"
                onClick={() => setImageIndex(i)}
                aria-pressed={i === imageIndex}
                aria-label={`Mostrar imagem ${i + 1} de ${nft.gallery.length}`}
                className={cn('w-16 shrink-0 overflow-hidden rounded-md border-2 border-transparent [&_img]:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', i === imageIndex && 'border-primary')}
              >
                <NftImage image={img} sizes="64px" decorative />
              </button>
            ))}
          </div>
          <div className="relative flex-1 self-start overflow-hidden rounded-lg bg-surface p-3">
            <div className="overflow-hidden rounded-md">
              <NftImage image={image} sizes={MAIN_SIZES} priority={imageIndex === 0} />
            </div>
            <FavoriteButton nftId={nft.id} name={nft.name} variant="overlay" className="absolute top-5 right-5 md:hidden" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 id="nft-title" className="text-lg font-extrabold md:text-xl">
              {nft.name}
            </h1>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span data-testid="nft-price" data-price={edition.price}>
                <Price value={edition.price} className="text-base" />
              </span>
              <Stars rating={nft.rating} count={nft.reviewsCount} />
            </div>
          </div>

          <div>
            <h2 className="text-xs font-bold">Sobre este NFT:</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{nft.description}</p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-bold">Edição:</legend>
            <RadioGroupPrimitive.Root
              className="flex flex-wrap gap-2"
              aria-label="Escolha a edição"
              value={edition.id}
              onValueChange={setEditionId}
              orientation="horizontal"
            >
              {nft.editions.map((ed) => {
                const selected = ed.id === edition.id
                const out = ed.available === 0
                return (
                  <RadioGroupPrimitive.Item
                    key={ed.id}
                    value={ed.id}
                    disabled={out}
                    data-testid={`edition-${ed.id}`}
                    aria-label={`${ed.label}, ${formatEth(ed.price)}, ${out ? 'esgotada' : `${ed.available} disponíveis`}`}
                    className={cn(
                      'flex min-w-28 flex-col items-start rounded-md border px-3 py-2 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      selected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60',
                      out && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <span className="font-bold">{ed.label}</span>
                    <span className="text-primary">{formatEth(ed.price)}</span>
                    <span className="text-[0.6875rem] text-muted-foreground">{out ? 'Esgotada' : `${ed.available} de ${ed.supply} disponíveis`}</span>
                  </RadioGroupPrimitive.Item>
                )
              })}
            </RadioGroupPrimitive.Root>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground" id="qty-label">
                Qtd.
              </span>
              <QuantityStepper value={quantity} max={Math.max(1, maxQty)} onChange={setQuantity} label={nft.name} disabled={soldOut} />
            </div>
            <Button onClick={buy} loading={addToCart.isPending} disabled={soldOut} className="min-w-32" data-testid="buy-button">
              {soldOut ? 'Esgotado' : 'Comprar'}
            </Button>
            <FavoriteButton nftId={nft.id} name={nft.name} variant="full" className="hidden md:inline-flex" />
          </div>
          {soldOut ? (
            <p className="text-xs text-warning" role="status">
              Esta edição está esgotada. Escolha outra edição disponível.
            </p>
          ) : (
            <p className="text-[0.6875rem] text-subtle-foreground">Máximo de {nft.maxPerOrder} edições por pedido.</p>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-border pt-4 text-xs">
            <dt className="text-muted-foreground">Nº de série:</dt>
            <dd>{nft.serial}</dd>
            <dt className="text-muted-foreground">Coleção:</dt>
            <dd>
              <Link to="/" search={{ col: nft.collection }} hash="catalogo" className="text-primary hover:underline">
                {COLLECTION_LABEL[nft.collection]}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Atributos:</dt>
            <dd>{nft.attributes.join(', ')}</dd>
            <dt className="text-muted-foreground">Rede:</dt>
            <dd>{NETWORK_LABEL[nft.network]}</dd>
            <dt className="text-muted-foreground">Criador:</dt>
            <dd>
              {nft.creator.name} <span className="text-subtle-foreground">@{nft.creator.handle}</span>
            </dd>
          </dl>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold">Compartilhar esse NFT:</span>
            <Button variant="ghost" size="icon-sm" onClick={share} aria-label="Copiar link do NFT">
              <Copy size={15} />
            </Button>
          </div>
        </div>
      </article>

      <section className="mt-10" aria-label="Informações detalhadas">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Detalhes do NFT</TabsTrigger>
            <TabsTrigger value="reviews">Avaliações de colecionadores ({nft.reviewsCount})</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
            <p>
              {nft.name} é uma obra digital da coleção {COLLECTION_LABEL[nft.collection]}, cunhada em {formatDate(nft.createdAt)}. Cada edição possui
              número de série próprio e metadados permanentes, garantindo procedência verificável na rede {NETWORK_LABEL[nft.network]}.
            </p>
            <p>
              <strong className="text-foreground">Raridade:</strong> {nft.rarity} — {nft.sales} edições já vendidas.
            </p>
            <p>
              <strong className="text-foreground">Utilidade:</strong> acesso antecipado a lançamentos de {nft.creator.name} e participação em eventos
              da comunidade Kurio.
            </p>
            <p>
              <strong className="text-foreground">Direitos autorais:</strong> uso pessoal e exibição; reprodução comercial requer autorização do criador.
            </p>
          </TabsContent>
          <TabsContent value="reviews">
            <ul className="flex flex-col gap-3">
              {reviews.map((r) => (
                <li key={r.author} className="rounded-md bg-surface p-3 text-xs">
                  <p className="font-bold">{r.author}</p>
                  <Stars rating={r.rating} />
                  <p className="mt-1 text-muted-foreground">{r.text}</p>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </section>
    </>
  )
}

function buildReviews(nft: NftDetail) {
  const texts = [
    'Arte impecável e entrega rápida na carteira. A procedência é clara.',
    'A edição Ouro vale cada centavo; os detalhes em alta resolução são incríveis.',
    'Comunidade ativa e criador muito presente. Recomendo.',
  ]
  return ['Lia M.', 'Caio R.', 'Bea S.'].map((author, i) => ({ author, rating: Math.max(3, Math.round(nft.rating) - (i === 2 ? 1 : 0)), text: texts[i] }))
}
