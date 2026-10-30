import { useCallback, useEffect, useRef, useState } from 'react'
import type { Network, Quote, Wallet } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { LoaderCircle, RefreshCw, TriangleAlert } from '@/components/icons'
import { NftImage } from '@/components/nft/nft-image'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { announce } from '@/lib/announce'
import { NETWORK_LABEL, PROVIDER_LABEL, formatEth, shortAddress } from '@/lib/format'
import { onRealtimeNotice } from '@/realtime/notices'
import { SummaryRows } from '@/features/cart/cart-page'
import type { usePlaceOrder } from './use-place-order'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  network: Network
  wallet: Wallet
  collector: { name: string; email: string; note: string }
  placeOrder: ReturnType<typeof usePlaceOrder>
  onPlaced: (orderId: string) => void
  requestQuote: () => Promise<Quote>
}

/** Diferenças entre duas cotações, em linguagem do usuário. */
function diffQuotes(before: Quote, after: Quote): string[] {
  const changes: string[] = []
  for (const line of after.items) {
    const prev = before.items.find((l) => l.lineId === line.lineId)
    if (!prev) continue
    if (prev.unitPrice !== line.unitPrice) changes.push(`${line.name}: ${formatEth(prev.unitPrice)} → ${formatEth(line.unitPrice)}`)
    if (prev.quantity !== line.quantity) changes.push(`${line.name}: quantidade ${prev.quantity} → ${line.quantity}`)
  }
  for (const prev of before.items) if (!after.items.some((l) => l.lineId === prev.lineId)) changes.push(`${prev.name} não está mais disponível`)
  if (before.discount !== after.discount) changes.push(`Desconto: ${formatEth(before.discount)} → ${formatEth(after.discount)}`)
  if (before.total !== after.total) changes.push(`Total: ${formatEth(before.total)} → ${formatEth(after.total)}`)
  return changes
}

export function ReviewDialog({ open, onOpenChange, network, wallet, collector, placeOrder, onPlaced, requestQuote }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string>()
  const [stale, setStale] = useState<string[] | null>(null)
  const [changes, setChanges] = useState<string[]>([])
  const [accept, setAccept] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const quoteRef = useRef<Quote | null>(null)
  quoteRef.current = quote
  // referências estáveis: re-renderizações do pai não podem refazer a cotação nem limpar o estado
  const requestQuoteRef = useRef(requestQuote)
  requestQuoteRef.current = requestQuote
  const busyRef = useRef(false)
  busyRef.current = placeOrder.isBusy || placeOrder.phase === 'done'

  const fetchQuote = useCallback(
    async (previous: Quote | null) => {
      setLoading(true)
      setLoadError(undefined)
      try {
        const next = await requestQuoteRef.current()
        setQuote(next)
        setStale(null)
        setAccept(false)
        if (previous) {
          const diff = diffQuotes(previous, next)
          setChanges(diff)
          if (diff.length) announce(`Valores atualizados: ${diff.join('; ')}. Revise e confirme novamente.`, 'assertive')
        } else setChanges([])
      } catch (err) {
        setLoadError(toApiError(err).message)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  // revalida preço, disponibilidade, cupom e taxas ao abrir a revisão
  useEffect(() => {
    if (open) {
      setSubmitError(undefined)
      void fetchQuote(null)
    } else {
      setQuote(null)
      setStale(null)
      setChanges([])
      setAccept(false)
    }
  }, [open, fetchQuote])

  // alteração recebida em tempo real para um item da cotação → cotação desatualizada
  useEffect(() => {
    if (!open) return
    return onRealtimeNotice((notice) => {
      if (notice.kind !== 'nft' || busyRef.current) return // durante o envio o servidor revalida a cotação
      const q = quoteRef.current
      const line = q?.items.find((i) => i.nftId === notice.event.data.nftId)
      if (!line) return
      const ed = notice.event.data.editions.find((e) => e.id === line.editionId)
      const message = ed && ed.price !== line.unitPrice ? `${line.name}: ${formatEth(line.unitPrice)} → ${formatEth(ed.price)}` : `${line.name}: disponibilidade alterada`
      setStale((s) => [...(s ?? []), message])
      setAccept(false)
      announce(`A cotação ficou desatualizada. ${message}. Atualize a cotação antes de confirmar.`, 'assertive')
    })
  }, [open])

  const confirm = async () => {
    if (!quote || stale || !accept) return
    setSubmitError(undefined)
    const result = await placeOrder.place({ quoteId: quote.quoteId, walletId: wallet.id, network, collector, acceptTerms: true })
    if (!result) return
    if (result.ok) {
      announce(result.replayed ? `Pedido ${result.order.number} recuperado sem duplicidade.` : `Pedido ${result.order.number} enviado.`)
      onPlaced(result.order.id)
      return
    }
    const e = result.error
    if (result.freshQuote) {
      const before = quote
      setQuote(result.freshQuote)
      setAccept(false)
      const diff = diffQuotes(before, result.freshQuote)
      setChanges(diff.length ? diff : [e.message])
      announce(`${e.message} ${diff.join('; ')}`, 'assertive')
      return
    }
    setSubmitError(e.message)
    announce(e.message, 'assertive')
  }

  const busy = placeOrder.isBusy
  const canConfirm = !!quote && quote.valid && !stale && accept && !busy && !loading

  return (
    <Dialog open={open} onOpenChange={(o) => (!busy ? onOpenChange(o) : undefined)}>
      <DialogContent
        className="max-w-xl max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[92dvh] max-sm:w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:left-0 max-sm:translate-x-0"
        onEscapeKeyDown={(e) => busy && e.preventDefault()}
        onInteractOutside={(e) => busy && e.preventDefault()}
        data-testid="review-dialog"
      >
        <DialogHeader>
          <DialogTitle>Revise seu pedido</DialogTitle>
          <DialogDescription>Confira itens, valores e taxas. Os preços foram revalidados agora.</DialogDescription>
        </DialogHeader>

        {loading && !quote ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Revalidando valores">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-24" />
          </div>
        ) : loadError ? (
          <Alert variant="destructive" role="alert">
            <TriangleAlert size={16} />
            <div className="flex flex-col gap-2">
              <AlertDescription>{loadError}</AlertDescription>
              <Button size="sm" variant="outline" onClick={() => void fetchQuote(quote)}>
                Tentar novamente
              </Button>
            </div>
          </Alert>
        ) : quote ? (
          <div className="flex flex-col gap-4">
            {stale ? (
              <Alert variant="warning" role="alert" data-testid="quote-stale">
                <TriangleAlert size={16} />
                <div className="flex flex-col gap-2">
                  <AlertTitle>Cotação desatualizada</AlertTitle>
                  <AlertDescription>
                    {stale.map((m) => (
                      <p key={m}>{m}</p>
                    ))}
                    <p>Atualize a cotação para ver os novos valores antes de confirmar.</p>
                  </AlertDescription>
                  <div>
                    <Button size="sm" onClick={() => void fetchQuote(quote)} loading={loading} data-testid="refresh-quote">
                      <RefreshCw size={14} /> Atualizar cotação
                    </Button>
                  </div>
                </div>
              </Alert>
            ) : changes.length ? (
              <Alert variant="info" data-testid="quote-changed">
                <TriangleAlert size={16} />
                <div>
                  <AlertTitle>Os valores mudaram — confirme novamente</AlertTitle>
                  <AlertDescription>
                    {changes.map((m) => (
                      <p key={m}>{m}</p>
                    ))}
                  </AlertDescription>
                </div>
              </Alert>
            ) : null}
            {!quote.valid ? (
              <Alert variant="destructive" role="alert">
                <TriangleAlert size={16} />
                <AlertDescription>
                  {quote.issues.map((i) => (
                    <p key={i.message}>{i.message}</p>
                  ))}
                  <p>Ajuste o carrinho para continuar.</p>
                </AlertDescription>
              </Alert>
            ) : null}

            <ul className="flex flex-col gap-2" aria-label="Itens do pedido">
              {quote.items.map((item) => (
                <li key={item.lineId} className="flex items-center gap-3 text-xs">
                  <NftImage image={item.image} sizes="40px" decorative className="size-10 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="text-[0.6875rem] text-muted-foreground">
                      {item.editionLabel} · {item.quantity} × {formatEth(item.unitPrice)}
                    </p>
                  </div>
                  <span className="font-semibold text-primary">{formatEth(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <SummaryRows quote={quote} />
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md bg-surface-2 p-3 text-xs">
              <dt className="text-muted-foreground">Carteira</dt>
              <dd>
                {wallet.label} · {PROVIDER_LABEL[wallet.provider]} · <span className="font-mono">{shortAddress(wallet.address)}</span>
              </dd>
              <dt className="text-muted-foreground">Rede</dt>
              <dd>{NETWORK_LABEL[network]}</dd>
              <dt className="text-muted-foreground">Colecionador</dt>
              <dd>
                {collector.name} · {collector.email}
              </dd>
            </dl>
            <div className="flex items-start gap-2">
              <Checkbox id="accept-review" checked={accept} onCheckedChange={(v) => setAccept(v === true)} disabled={!!stale || busy} aria-describedby="accept-hint" />
              <div>
                <Label htmlFor="accept-review" className="leading-snug">
                  Revisei os itens, valores e taxas e autorizo o pagamento simulado.
                </Label>
                <p id="accept-hint" className="text-[0.6875rem] text-subtle-foreground">
                  Obrigatório para confirmar. Nenhum valor real é cobrado nesta demonstração.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div aria-live="polite" className="text-xs" data-testid="submit-status">
          {placeOrder.phase === 'submitting' ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <LoaderCircle size={14} className="animate-spin" /> Enviando pedido…
            </p>
          ) : placeOrder.phase === 'recovering' ? (
            <p className="flex items-center gap-2 text-warning" data-testid="recovering">
              <LoaderCircle size={14} className="animate-spin" /> A resposta demorou. Recuperando o mesmo pedido com segurança (tentativa {placeOrder.attemptNumber} de 3)…
            </p>
          ) : null}
        </div>
        {submitError ? (
          <Alert variant="destructive" role="alert" data-testid="submit-error">
            <TriangleAlert size={16} />
            <div className="flex flex-col gap-1">
              <AlertDescription>{submitError}</AlertDescription>
              <p className="text-[0.6875rem] text-muted-foreground">Seus itens continuam no carrinho. Tentar novamente usa a mesma chave e não duplica a compra.</p>
            </div>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Voltar
          </Button>
          <Button onClick={() => void confirm()} disabled={!canConfirm} loading={busy} data-testid="confirm-order">
            {quote ? `Confirmar pagamento · ${formatEth(quote.total)}` : 'Confirmar pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
