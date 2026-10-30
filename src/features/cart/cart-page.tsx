import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { Cart, CartLine, Quote } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { ArrowLeft, Info, RefreshCw, ShoppingCart, TicketPercent, Trash, TriangleAlert, X } from '@/components/icons'
import { NftImage } from '@/components/nft/nft-image'
import { Price } from '@/components/nft/price'
import { QuantityStepper } from '@/components/nft/quantity-stepper'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { announce } from '@/lib/announce'
import { formatEth } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import { cn } from '@/lib/utils'
import { useApplyCoupon, useCart, useCartQuote, useRemoveCartItem, useRemoveCoupon, useUpdateCartQuantity } from '@/queries/cart'
import { useSession } from '@/session/session'
import { RelatedCarousel } from '@/features/nft/related-carousel'

export function CartPage() {
  usePageMeta({ title: 'Carrinho de NFTs — Kurio' })
  const cart = useCart()
  const quote = useCartQuote(cart.data)

  return (
    <div className="container-kurio pt-4 md:pt-8">
      <div className="mb-4 flex items-center gap-2 md:hidden">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/" aria-label="Voltar ao catálogo">
            <ArrowLeft size={18} />
          </Link>
        </Button>
      </div>
      <h1 className="mb-4 text-base font-bold md:text-lg">Carrinho de NFTs</h1>

      {cart.isPending ? (
        <CartSkeleton />
      ) : cart.isError && !cart.data ? (
        <Alert variant="destructive" role="alert">
          <TriangleAlert size={16} />
          <div className="flex flex-col gap-2">
            <AlertTitle>Não foi possível carregar seu carrinho</AlertTitle>
            <AlertDescription>{toApiError(cart.error).message}</AlertDescription>
            <div>
              <Button size="sm" variant="outline" onClick={() => void cart.refetch()} loading={cart.isFetching}>
                <RefreshCw size={14} /> Tentar novamente
              </Button>
            </div>
          </div>
        </Alert>
      ) : cart.data && cart.data.items.length === 0 ? (
        <EmptyCart />
      ) : cart.data ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <CartItems cart={cart.data} quote={quote.data} />
          <CartSummary cart={cart.data} quote={quote.data} quoteLoading={quote.isPending || (quote.isFetching && !quote.data)} quoteError={quote.error} onRetry={() => void quote.refetch()} />
        </div>
      ) : null}

      <RelatedCarousel nftId={cart.data?.items[0]?.nftId ?? 'emerald-ape-042'} title="Colecionadores também viram" />
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-16 text-center" data-testid="cart-empty">
      <ShoppingCart size={32} className="text-muted-foreground" />
      <p className="text-sm font-bold">Seu carrinho está vazio</p>
      <p className="text-xs text-muted-foreground">Explore o catálogo e adicione NFTs para continuar.</p>
      <Button asChild>
        <Link to="/" hash="catalogo">
          Explorar NFTs
        </Link>
      </Button>
    </div>
  )
}

function CartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true" aria-label="Carregando carrinho" data-testid="cart-skeleton">
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <SummarySkeleton />
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface p-4" data-testid="summary-skeleton">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

function LineNotices({ line }: { line: CartLine }) {
  const priceChanged = line.unitPrice !== line.addedUnitPrice
  return (
    <>
      {priceChanged ? (
        <p className="flex items-center gap-1 text-[0.6875rem] text-warning" data-testid="price-changed">
          <Info size={12} /> Preço atualizado: era {formatEth(line.addedUnitPrice)}
        </p>
      ) : null}
      {line.available === 0 ? (
        <p className="flex items-center gap-1 text-[0.6875rem] text-destructive" data-testid="sold-out">
          <TriangleAlert size={12} /> Esgotado — remova para finalizar
        </p>
      ) : line.quantity > line.available ? (
        <p className="flex items-center gap-1 text-[0.6875rem] text-warning">
          <TriangleAlert size={12} /> Restam apenas {line.available}
        </p>
      ) : null}
    </>
  )
}

function CartItems({ cart }: { cart: Cart; quote: Quote | undefined }) {
  const update = useUpdateCartQuantity()
  const remove = useRemoveCartItem()
  const onRemove = (line: CartLine) =>
    remove.mutate(line.lineId, {
      onSuccess: () => {
        announce(`${line.name} removido do carrinho.`)
        toast.success('Item removido', { description: line.name })
      },
      onError: (e) => toast.error('Não foi possível remover', { description: toApiError(e).message }),
    })

  return (
    <section aria-labelledby="cart-items-title">
      <h2 id="cart-items-title" className="sr-only">
        Itens do carrinho
      </h2>
      {/* desktop: tabela como no Figma */}
      <table className="hidden w-full border-separate border-spacing-y-2 text-xs md:table" data-testid="cart-table">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th scope="col" className="pb-1 font-semibold">
              NFT
            </th>
            <th scope="col" className="pb-1 font-semibold">
              Preço
            </th>
            <th scope="col" className="pb-1 font-semibold">
              Edições
            </th>
            <th scope="col" className="pb-1 font-semibold">
              Total
            </th>
            <th scope="col" className="pb-1">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {cart.items.map((line) => (
            <tr key={line.lineId} className="bg-surface" data-testid="cart-line" data-line-id={line.lineId}>
              <td className="rounded-l-lg p-2">
                <div className="flex items-center gap-3">
                  <NftImage image={line.image} sizes="56px" decorative className="size-14 shrink-0" />
                  <div className="min-w-0">
                    <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="font-semibold hover:text-primary">
                      {line.name}
                    </Link>
                    <p className="text-[0.6875rem] text-muted-foreground">Edição: {line.editionLabel}</p>
                    <LineNotices line={line} />
                  </div>
                </div>
              </td>
              <td className="p-2">
                <Price value={line.unitPrice} className="font-semibold text-foreground" />
              </td>
              <td className="p-2">
                <QuantityStepper
                  value={line.quantity}
                  max={Math.max(1, Math.min(line.available, line.maxPerOrder))}
                  onChange={(q) => update.mutate({ lineId: line.lineId, quantity: q })}
                  label={line.name}
                  disabled={line.available === 0}
                  size="sm"
                />
              </td>
              <td className="p-2">
                <span data-testid="line-total">
                  <Price value={line.unitPrice * line.quantity} />
                </span>
              </td>
              <td className="rounded-r-lg p-2 text-right">
                <Button variant="ghost" size="icon-sm" onClick={() => onRemove(line)} aria-label={`Remover ${line.name} do carrinho`}>
                  <Trash size={15} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* mobile: lista de cartões */}
      <ul className="flex flex-col gap-2 md:hidden" data-testid="cart-list">
        {cart.items.map((line) => (
          <li key={line.lineId} className="flex gap-3 rounded-lg bg-surface p-2" data-testid="cart-line-mobile">
            <NftImage image={line.image} sizes="72px" decorative className="size-18 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
              <div className="flex items-start justify-between gap-2">
                <Link to="/nft/$nftId" params={{ nftId: line.nftId }} className="truncate font-semibold">
                  {line.name}
                </Link>
                <Button variant="ghost" size="icon-sm" onClick={() => onRemove(line)} aria-label={`Remover ${line.name} do carrinho`} className="-mt-1 -mr-1">
                  <Trash size={14} />
                </Button>
              </div>
              <p className="text-[0.6875rem] text-muted-foreground">Edição: {line.editionLabel}</p>
              <LineNotices line={line} />
              <div className="mt-auto flex items-center justify-between">
                <Price value={line.unitPrice * line.quantity} />
                <QuantityStepper
                  value={line.quantity}
                  max={Math.max(1, Math.min(line.available, line.maxPerOrder))}
                  onChange={(q) => update.mutate({ lineId: line.lineId, quantity: q })}
                  label={line.name}
                  disabled={line.available === 0}
                  size="sm"
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function CouponForm({ cart }: { cart: Cart }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  if (cart.couponCode) {
    return (
      <div className="flex items-center justify-between rounded-md border border-success/40 bg-success/10 px-3 py-2 text-xs" data-testid="coupon-applied">
        <span className="flex items-center gap-2">
          <TicketPercent size={14} className="text-success" /> Cupom <strong>{cart.couponCode}</strong> aplicado
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remover cupom ${cart.couponCode}`}
          onClick={() => remove.mutate(undefined, { onSuccess: () => announce('Cupom removido.') })}
          loading={remove.isPending}
        >
          <X size={14} />
        </Button>
      </div>
    )
  }
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const value = code.trim()
        if (value.length < 3) {
          setError('Informe um código com ao menos 3 caracteres.')
          return
        }
        setError(undefined)
        apply.mutate(value, {
          onSuccess: (c) => {
            setCode('')
            announce(`Cupom ${c.couponCode} aplicado.`)
            toast.success('Cupom aplicado', { description: c.couponCode ?? undefined })
          },
          onError: (err) => {
            const e = toApiError(err)
            setError(e.fieldErrors.code ?? e.message)
          },
        })
      }}
      className="flex flex-col gap-1.5"
    >
      <label htmlFor="coupon" className="text-xs font-medium">
        Código promocional
      </label>
      <div className="flex">
        <Input
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o código promocional"
          className="h-9 rounded-r-none text-xs uppercase placeholder:normal-case"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'coupon-error' : undefined}
          autoComplete="off"
        />
        <Button type="submit" size="sm" className="h-9 rounded-l-none" loading={apply.isPending}>
          Aplicar
        </Button>
      </div>
      {error ? (
        <p id="coupon-error" role="alert" className="text-xs text-destructive" data-testid="coupon-error">
          {error}
        </p>
      ) : null}
    </form>
  )
}

export function SummaryRows({ quote }: { quote: Quote }) {
  return (
    <dl className="flex flex-col gap-2 text-xs" data-testid="summary">
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd data-testid="summary-subtotal">{formatEth(quote.subtotal)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Desconto{quote.coupon?.status === 'applied' ? ` (${quote.coupon.code})` : ''}</dt>
        <dd data-testid="summary-discount">{quote.discount ? `(-) ${formatEth(quote.discount)}` : formatEth(0)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Taxa de serviço (2,5%)</dt>
        <dd>{formatEth(quote.serviceFee)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted-foreground">Taxa de rede (estimada)</dt>
        <dd>{formatEth(quote.networkFee)}</dd>
      </div>
      <div className="mt-1 flex justify-between border-t border-border pt-3 text-sm font-bold">
        <dt>Total</dt>
        <dd className="text-primary" data-testid="summary-total" data-total={quote.total}>
          {formatEth(quote.total)}
        </dd>
      </div>
    </dl>
  )
}

function CartSummary({
  cart,
  quote,
  quoteLoading,
  quoteError,
  onRetry,
}: {
  cart: Cart
  quote: Quote | undefined
  quoteLoading: boolean
  quoteError: unknown
  onRetry: () => void
}) {
  const navigate = useNavigate()
  const { isAuthenticated } = useSession()
  const blocking = quote?.issues.filter((i) => i.type !== 'price_changed') ?? []
  const priceChanges = quote?.issues.filter((i) => i.type === 'price_changed') ?? []
  return (
    <aside aria-labelledby="summary-title" className="flex h-fit flex-col gap-4 rounded-lg bg-surface p-4 lg:sticky lg:top-20">
      <h2 id="summary-title" className="border-b border-border pb-2 text-sm font-bold">
        Resumo do carrinho
      </h2>
      <CouponForm cart={cart} />
      {quoteLoading && !quote ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Calculando valores">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      ) : quote ? (
        <div className={cn('transition-opacity', quoteLoading && 'opacity-60')}>
          <SummaryRows quote={quote} />
        </div>
      ) : quoteError ? (
        <Alert variant="destructive" role="alert">
          <TriangleAlert size={16} />
          <div className="flex flex-col gap-2">
            <AlertDescription>{toApiError(quoteError).message}</AlertDescription>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Recalcular
            </Button>
          </div>
        </Alert>
      ) : null}

      {priceChanges.length ? (
        <Alert variant="warning" data-testid="summary-price-changed">
          <Info size={16} />
          <AlertDescription>
            {priceChanges.map((i) => (
              <p key={(i.lineId ?? '') + i.message}>
                {i.message} {i.previous !== undefined && i.current !== undefined ? `(${formatEth(i.previous)} → ${formatEth(i.current)})` : ''}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
      {blocking.length ? (
        <Alert variant="destructive" role="alert">
          <TriangleAlert size={16} />
          <AlertDescription>
            {blocking.map((i) => (
              <p key={(i.lineId ?? '') + i.message}>{i.message}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        size="lg"
        className="w-full"
        disabled={!quote?.valid}
        onClick={() => void navigate(isAuthenticated ? { to: '/pagamento' } : { to: '/entrar', search: { redirect: '/pagamento' } })}
        data-testid="checkout-button"
      >
        Comprar e finalizar
      </Button>
      <Button asChild variant="link" className="self-center text-xs">
        <Link to="/" hash="catalogo">
          Continuar comprando
        </Link>
      </Button>
    </aside>
  )
}
