import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { toast } from 'sonner'
import { collectorSchema, type CreateOrderRequest, type Network, type Quote } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { ArrowLeft, CircleCheck, Plug, RefreshCw, TriangleAlert, Unplug, Wallet as WalletIcon } from '@/components/icons'
import { NftImage } from '@/components/nft/nft-image'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { announce } from '@/lib/announce'
import { NETWORK_LABEL, PROVIDER_LABEL, formatEth, shortAddress } from '@/lib/format'
import { loadAttempt } from '@/lib/idempotency'
import { usePageMeta } from '@/lib/page-meta'
import { readJson, writeJson } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { useWalletConnection, useWallets } from '@/queries/account'
import { useCart, useCartQuote } from '@/queries/cart'
import { useSession } from '@/session/session'
import { SummaryRows } from '@/features/cart/cart-page'
import { NETWORKS_BY_PROVIDER } from './networks'
import { ReviewDialog } from './review-dialog'
import { usePlaceOrder } from './use-place-order'

interface Draft {
  name: string
  email: string
  note: string
  walletId: string | null
  network: Network | null
}

const draftKey = (userId: string) => `kurio:checkout:draft:${userId}`

export function CheckoutPage() {
  usePageMeta({ title: 'Pagamento — Kurio' })
  const { user } = useSession()
  if (!user) return null
  return <Checkout userId={user.id} defaultName={user.displayName} defaultEmail={user.email} />
}

function Checkout({ userId, defaultName, defaultEmail }: { userId: string; defaultName: string; defaultEmail: string }) {
  const navigate = useNavigate()
  const cart = useCart()
  const walletsQuery = useWallets()
  const { connect, disconnect } = useWalletConnection()
  const wallets = walletsQuery.data?.items ?? []
  const connection = walletsQuery.data?.connection ?? null

  // rascunho do formulário: sobrevive a refresh e à expiração da sessão (retomada após novo login)
  const [draft, setDraft] = useState<Draft>(() => readJson<Draft>(draftKey(userId), 'session') ?? { name: defaultName, email: defaultEmail, note: '', walletId: null, network: null })
  useEffect(() => writeJson(draftKey(userId), draft, 'session'), [draft, userId])

  const wallet = wallets.find((w) => w.id === draft.walletId) ?? wallets.find((w) => w.isDefault) ?? wallets[0]
  const allowedNetworks = wallet ? NETWORKS_BY_PROVIDER[wallet.provider] : []
  const network: Network = draft.network && allowedNetworks.includes(draft.network) ? draft.network : (wallet?.network ?? 'ethereum')
  const isConnected = !!wallet && connection?.walletId === wallet.id && connection.network === network

  const preview = useCartQuote(cart.data, network)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [walletError, setWalletError] = useState<string>()
  const [reviewOpen, setReviewOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const reviewButtonRef = useRef<HTMLButtonElement>(null)
  const placeOrder = usePlaceOrder(userId)
  // a tentativa salva (sessionStorage) é relida quando o envio do pedido muda de fase
  const phase = placeOrder.phase
  const savedAttempt = useMemo(() => {
    void phase
    return loadAttempt<CreateOrderRequest>(userId)
  }, [userId, phase])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const onConnect = () => {
    if (!wallet) return
    setWalletError(undefined)
    connect.mutate(
      { walletId: wallet.id, network },
      {
        onSuccess: () => {
          announce(`Carteira ${wallet.label} conectada na rede ${NETWORK_LABEL[network]}.`)
          toast.success('Carteira conectada', { description: `${PROVIDER_LABEL[wallet.provider]} · ${NETWORK_LABEL[network]}` })
        },
        onError: (err) => {
          const e = toApiError(err)
          setWalletError(e.message)
          announce(e.message, 'assertive')
        },
      },
    )
  }

  const onDisconnect = () => {
    if (!wallet) return
    disconnect.mutate(wallet.id, { onSuccess: () => announce('Carteira desconectada.') })
  }

  const validate = (): boolean => {
    const result = collectorSchema.safeParse({ name: draft.name, email: draft.email, note: draft.note })
    const next: Record<string, string> = {}
    if (!result.success) for (const issue of result.error.issues) next[String(issue.path[0])] ??= issue.message
    if (!wallet) next.wallet = 'Cadastre e selecione uma carteira.'
    else if (!isConnected) next.wallet = 'Conecte a carteira selecionada na rede escolhida.'
    setErrors(next)
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0]
      const el = formRef.current?.querySelector<HTMLElement>(first === 'wallet' ? '[data-field="wallet"] [role="radio"][data-state="checked"], [data-field="wallet"] button, [data-field="wallet"] a' : `#checkout-${first}`)
      el?.focus()
      announce(`Verifique os campos: ${Object.values(next).join(' ')}`, 'assertive')
      return false
    }
    return true
  }

  const onReview = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) setReviewOpen(true)
  }

  const resume = async () => {
    const result = await placeOrder.resume()
    if (!result) return
    if (result.ok) {
      toast.success(`Pedido ${result.order.number} recuperado`, { description: 'Nenhuma compra duplicada foi criada.' })
      void navigate({ to: '/pedidos/$orderId', params: { orderId: result.order.id } })
    } else {
      toast.error('Não foi possível recuperar o pedido', { description: result.error.message })
    }
  }

  if (cart.isPending || walletsQuery.isPending) return <CheckoutSkeleton />
  if (cart.data && cart.data.items.length === 0 && !savedAttempt) {
    return (
      <div className="container-kurio flex flex-col items-center gap-3 py-20 text-center" data-testid="checkout-empty">
        <p className="text-sm font-bold">Seu carrinho está vazio</p>
        <Button asChild>
          <Link to="/" hash="catalogo">
            Explorar NFTs
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container-kurio pt-4 md:pt-6">
      <nav aria-label="Trilha de navegação" className="mb-4 hidden text-[0.6875rem] text-muted-foreground md:block">
        <ol className="flex items-center gap-1">
          <li>
            <Link to="/" className="hover:text-primary">
              Início
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/carrinho" className="hover:text-primary">
              Carrinho
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-foreground">
            Pagamento
          </li>
        </ol>
      </nav>
      <div className="mb-4 flex items-center gap-2 md:hidden">
        <Button asChild variant="ghost" size="icon-sm">
          <Link to="/carrinho" aria-label="Voltar ao carrinho">
            <ArrowLeft size={18} />
          </Link>
        </Button>
      </div>
      <h1 className="mb-4 text-base font-bold md:sr-only">Pagamento com carteira</h1>

      {savedAttempt ? (
        <Alert variant="warning" className="mb-4" data-testid="attempt-recovery">
          <TriangleAlert size={16} />
          <div className="flex flex-1 flex-col gap-2">
            <AlertTitle>Há um envio de pedido sem confirmação</AlertTitle>
            <AlertDescription>
              Uma tentativa anterior não recebeu resposta (timeout ou página recarregada). Recupere o pedido com a mesma chave de idempotência — se ele já foi
              criado, nenhuma compra duplicada será feita.
            </AlertDescription>
            <div>
              <Button size="sm" onClick={resume} loading={placeOrder.isBusy} data-testid="resume-order">
                <RefreshCw size={14} /> Recuperar pedido
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      <form ref={formRef} onSubmit={onReview} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]" aria-label="Dados de pagamento">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="collector-title" className="flex flex-col gap-4">
            <h2 id="collector-title" className="text-sm font-bold">
              Perfil do colecionador
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="checkout-name" label="Nome de exibição" required error={errors.name}>
                {(p) => <Input {...p} autoComplete="name" value={draft.name} onChange={(e) => update({ name: e.target.value })} />}
              </Field>
              <Field id="checkout-email" label="E-mail para o recibo" required error={errors.email}>
                {(p) => <Input {...p} type="email" autoComplete="email" value={draft.email} onChange={(e) => update({ email: e.target.value })} />}
              </Field>
            </div>
            <Field id="checkout-note" label="Observação do colecionador (opcional)" error={errors.note} description="Até 280 caracteres. Aparece no recibo.">
              {(p) => <Textarea {...p} maxLength={280} value={draft.note} onChange={(e) => update({ note: e.target.value })} />}
            </Field>
          </section>

          <section aria-labelledby="wallet-title" className="flex flex-col gap-3" data-field="wallet">
            <div className="flex items-center justify-between">
              <h2 id="wallet-title" className="text-sm font-bold">
                Carteira conectada
              </h2>
              <Link to="/perfil/carteiras" search={{ from: 'checkout' }} className="text-xs text-primary hover:underline">
                {wallets.length ? 'Gerenciar carteiras' : 'Cadastrar carteira'}
              </Link>
            </div>
            {wallets.length === 0 ? (
              <Alert variant="info" data-testid="no-wallets">
                <WalletIcon size={16} />
                <div className="flex flex-col gap-2">
                  <AlertTitle>Nenhuma carteira cadastrada</AlertTitle>
                  <AlertDescription>Cadastre sua carteira principal para pagar com segurança.</AlertDescription>
                  <div>
                    <Button asChild size="sm">
                      <Link to="/perfil/carteiras" search={{ from: 'checkout' }}>
                        Cadastrar carteira
                      </Link>
                    </Button>
                  </div>
                </div>
              </Alert>
            ) : (
              <RadioGroupPrimitive.Root
                aria-label="Escolha a carteira"
                className="grid gap-2 sm:grid-cols-2"
                value={wallet?.id}
                onValueChange={(id) => update({ walletId: id, network: wallets.find((w) => w.id === id)?.network ?? null })}
              >
                {wallets.map((w) => {
                  const selected = w.id === wallet?.id
                  return (
                    <RadioGroupPrimitive.Item
                      key={w.id}
                      value={w.id}
                      data-testid={`wallet-option-${w.slot}`}
                      className={cn(
                        'flex flex-col items-start gap-0.5 rounded-lg border p-3 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        selected ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:border-primary/50',
                      )}
                    >
                      <span className="flex w-full items-center justify-between font-bold">
                        {w.label} <span className="text-[0.625rem] font-normal text-muted-foreground uppercase">{w.slot === 'primary' ? 'Principal' : 'Secundária'}</span>
                      </span>
                      <span className="text-muted-foreground">{PROVIDER_LABEL[w.provider]}</span>
                      <span className="font-mono text-[0.6875rem] text-subtle-foreground">{shortAddress(w.address)}</span>
                    </RadioGroupPrimitive.Item>
                  )
                })}
              </RadioGroupPrimitive.Root>
            )}

            {wallet ? (
              <div className="grid gap-3 rounded-lg bg-surface p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="checkout-network" className="text-xs font-medium">
                    Rede de pagamento
                  </label>
                  <NativeSelect id="checkout-network" value={network} onChange={(e) => update({ network: e.target.value as Network })} aria-describedby="network-hint">
                    {allowedNetworks.map((n) => (
                      <option key={n} value={n}>
                        {NETWORK_LABEL[n]}
                      </option>
                    ))}
                  </NativeSelect>
                  <span id="network-hint" className="text-[0.6875rem] text-subtle-foreground">
                    A taxa de rede muda conforme a rede escolhida.
                  </span>
                </div>
                {isConnected ? (
                  <Button type="button" variant="outline" onClick={onDisconnect} loading={disconnect.isPending} data-testid="disconnect-wallet">
                    <Unplug size={14} /> Desconectar
                  </Button>
                ) : (
                  <Button type="button" onClick={onConnect} loading={connect.isPending} data-testid="connect-wallet">
                    <Plug size={14} /> Conectar carteira
                  </Button>
                )}
                <p className={cn('flex items-center gap-1.5 text-xs sm:col-span-2', isConnected ? 'text-success' : 'text-muted-foreground')} role="status" data-testid="wallet-status">
                  {isConnected ? <CircleCheck size={14} /> : <Plug size={14} />}
                  {isConnected
                    ? `Conectada: ${PROVIDER_LABEL[wallet.provider]} na rede ${NETWORK_LABEL[network]}`
                    : connect.isPending
                      ? 'Aguardando aprovação na carteira…'
                      : 'Carteira não conectada'}
                </p>
                {walletError ? (
                  <p role="alert" className="text-xs text-destructive sm:col-span-2" data-testid="wallet-error">
                    {walletError}
                  </p>
                ) : null}
              </div>
            ) : null}
            {errors.wallet ? (
              <p role="alert" className="text-xs text-destructive" id="checkout-wallet-error">
                ⚠ {errors.wallet}
              </p>
            ) : null}
          </section>
        </div>

        <aside aria-labelledby="your-nfts" className="flex h-fit flex-col gap-4 rounded-lg bg-surface p-4 lg:sticky lg:top-20">
          <h2 id="your-nfts" className="text-sm font-bold">
            Seus NFTs
          </h2>
          <ul className="flex flex-col gap-2">
            {cart.data?.items.map((line) => (
              <li key={line.lineId} className="flex items-center gap-3 rounded-md bg-surface-2 p-2 text-xs">
                <NftImage image={line.image} sizes="40px" decorative className="size-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{line.name}</p>
                  <p className="text-[0.6875rem] text-muted-foreground">
                    {line.editionLabel} · {line.quantity}×
                  </p>
                </div>
                <span className="font-semibold text-primary">{formatEth(line.unitPrice * line.quantity)}</span>
              </li>
            ))}
          </ul>
          {preview.data ? <SummaryRows quote={preview.data} /> : <SummaryPlaceholder />}
          {preview.data && !preview.data.valid ? (
            <Alert variant="destructive" role="alert">
              <TriangleAlert size={16} />
              <AlertDescription>
                {preview.data.issues.map((i) => (
                  <p key={i.message}>{i.message}</p>
                ))}
                <Link to="/carrinho" className="text-primary underline">
                  Revisar carrinho
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}
          <Button ref={reviewButtonRef} type="submit" size="lg" className="w-full" disabled={!preview.data?.valid} data-testid="review-button">
            Revisar pedido
          </Button>
          <p className="text-center text-[0.6875rem] text-subtle-foreground">Você confirma o pagamento na próxima etapa.</p>
        </aside>
      </form>

      {wallet ? (
        <ReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          userId={userId}
          network={network}
          wallet={wallet}
          collector={{ name: draft.name.trim(), email: draft.email.trim(), note: draft.note.trim() }}
          placeOrder={placeOrder}
          onPlaced={(orderId) => {
            setReviewOpen(false)
            void navigate({ to: '/pedidos/$orderId', params: { orderId } })
          }}
          requestQuote={() => api.quotes.create(network)}
          returnFocusRef={reviewButtonRef}
        />
      ) : null}
    </div>
  )
}

function SummaryPlaceholder() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Calculando valores" data-testid="summary-skeleton">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="container-kurio grid grid-cols-1 gap-6 pt-8 lg:grid-cols-[minmax(0,1fr)_360px]" aria-busy="true" aria-label="Carregando pagamento">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-24" />
        <Skeleton className="h-28" />
      </div>
      <div className="flex flex-col gap-3 rounded-lg bg-surface p-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <SummaryPlaceholder />
      </div>
    </div>
  )
}

export type { Quote }
