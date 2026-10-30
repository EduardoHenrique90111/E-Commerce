import { useEffect } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import type { Order } from '@/api/contracts'
import { toApiError } from '@/api/errors'
import { CircleCheck, CircleX, Copy, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, TriangleAlert } from '@/components/icons'
import { ConnectionIndicator } from '@/components/layout/connection-indicator'
import { NftImage } from '@/components/nft/nft-image'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { announce } from '@/lib/announce'
import { NETWORK_LABEL, PROVIDER_LABEL, formatDateTime, formatEth, shortAddress } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import { useOrder } from '@/queries/orders'
import { useSession } from '@/session/session'
import { setPendingOrder } from '@/features/checkout/pending-order'

export function OrderPage() {
  const { orderId } = useParams({ from: '/_auth/pedidos/$orderId' })
  const order = useOrder(orderId)
  const { user } = useSession()
  const error = order.error ? toApiError(order.error) : null
  usePageMeta({ title: order.data ? `Pedido ${order.data.number} — Kurio` : 'Pedido — Kurio' })

  // estados terminais encerram o acompanhamento do pedido pendente
  useEffect(() => {
    if (!user || !order.data) return
    if (order.data.status === 'pending') setPendingOrder(user.id, order.data.id)
    else setPendingOrder(user.id, null)
  }, [user, order.data])

  return (
    <div className="container-kurio flex justify-center pt-6 md:pt-12">
      <div className="w-full max-w-xl">
        {order.isPending ? (
          <div className="flex flex-col gap-3 rounded-lg bg-surface p-6" aria-busy="true" aria-label="Carregando pedido">
            <Skeleton className="mx-auto size-16 rounded-full" />
            <Skeleton className="mx-auto h-5 w-60" />
            <Skeleton className="h-16" />
            <Skeleton className="h-32" />
          </div>
        ) : error && !order.data ? (
          <Alert variant="destructive" role="alert" data-testid={error.status === 403 ? 'order-forbidden' : 'order-error'}>
            <TriangleAlert size={16} />
            <div className="flex flex-col gap-2">
              <AlertTitle>{error.status === 403 ? 'Acesso negado' : error.status === 404 ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
              <div className="flex gap-2">
                {error.isTransient ? (
                  <Button size="sm" variant="outline" onClick={() => void order.refetch()}>
                    <RefreshCw size={14} /> Tentar novamente
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link to="/pedidos">Meus pedidos</Link>
                </Button>
              </div>
            </div>
          </Alert>
        ) : order.data?.status === 'pending' ? (
          <PendingOrder order={order.data} refreshing={order.isFetching} onRefresh={() => void order.refetch()} />
        ) : order.data?.status === 'rejected' ? (
          <RejectedOrder order={order.data} />
        ) : order.data ? (
          <Receipt order={order.data} />
        ) : null}
      </div>
    </div>
  )
}

function PendingOrder({ order, refreshing, onRefresh }: { order: Order; refreshing: boolean; onRefresh: () => void }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-lg bg-surface p-6 text-center" aria-labelledby="pending-title" data-testid="order-pending" role="status">
      <LoaderCircle size={44} className="animate-spin text-primary" />
      <h1 id="pending-title" className="text-base font-bold">
        Aguardando confirmação da carteira
      </h1>
      <p className="text-xs text-muted-foreground">
        Pedido <strong className="text-foreground">{order.number}</strong> · {formatEth(order.total)}. Você pode fechar ou recarregar esta página: o status será recuperado
        automaticamente e nenhuma compra duplicada será criada.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <ConnectionIndicator showLabel />
        <Button size="sm" variant="outline" onClick={onRefresh} loading={refreshing}>
          <RefreshCw size={14} /> Verificar agora
        </Button>
      </div>
    </section>
  )
}

function RejectedOrder({ order }: { order: Order }) {
  useEffect(() => announce(`Pagamento do pedido ${order.number} recusado.`, 'assertive'), [order.number])
  return (
    <section className="flex flex-col items-center gap-4 rounded-lg border border-destructive/40 bg-surface p-6 text-center" aria-labelledby="rejected-title" data-testid="order-rejected">
      <CircleX size={44} className="text-destructive" />
      <h1 id="rejected-title" className="text-base font-bold">
        Pagamento recusado
      </h1>
      <p className="text-xs text-muted-foreground">{order.failureReason ?? 'A transação não foi concluída.'}</p>
      <p className="text-xs">
        Pedido <strong>{order.number}</strong> · nenhum valor foi cobrado. Seus itens continuam no carrinho.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link to="/carrinho">Voltar ao carrinho</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/pedidos">Meus pedidos</Link>
        </Button>
      </div>
    </section>
  )
}

/** Recibo: reproduz exatamente o snapshot do pedido (valores não dependem do catálogo atual). */
function Receipt({ order }: { order: Order }) {
  const copyHash = async () => {
    if (!order.transaction) return
    try {
      await navigator.clipboard.writeText(order.transaction.hash)
      announce('Identificador da transação copiado.')
    } catch {
      /* sem permissão de clipboard */
    }
  }
  return (
    <section className="overflow-hidden rounded-lg bg-surface" aria-labelledby="receipt-title" data-testid="order-confirmed">
      <div className="flex flex-col items-center gap-2 px-6 pt-6 text-center">
        <CircleCheck size={44} className="text-success" />
        <h1 id="receipt-title" className="text-base font-bold">
          Seus NFTs agora estão na sua carteira
        </h1>
        <p className="text-xs text-muted-foreground">Pagamento confirmado na simulação.</p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-px border-y border-border bg-border text-xs sm:grid-cols-4">
        {[
          ['Pedido', order.number],
          ['Data', order.settledAt ? formatDateTime(order.settledAt) : formatDateTime(order.createdAt)],
          ['Total', formatEth(order.total)],
          ['Carteira', `${order.wallet.label} (${PROVIDER_LABEL[order.wallet.provider]})`],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-3 py-2">
            <dt className="text-[0.6875rem] text-muted-foreground">{k}</dt>
            <dd className="font-semibold break-words" data-testid={`receipt-info-${k.toLowerCase()}`}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-3 p-6">
        <h2 className="text-xs font-bold">Detalhes da transação</h2>
        {order.transaction ? (
          <div className="flex items-center gap-2 rounded-md bg-surface-2 p-2 text-[0.6875rem]">
            <span className="text-muted-foreground">ID da transação</span>
            <code className="min-w-0 flex-1 truncate font-mono" data-testid="receipt-tx" title={order.transaction.hash}>
              {order.transaction.hash}
            </code>
            <Button variant="ghost" size="icon-sm" onClick={copyHash} aria-label="Copiar identificador da transação">
              <Copy size={14} />
            </Button>
          </div>
        ) : null}
        <table className="w-full text-xs">
          <caption className="sr-only">Itens comprados</caption>
          <thead>
            <tr className="text-left text-muted-foreground">
              <th scope="col" className="pb-2 font-semibold">
                NFTs
              </th>
              <th scope="col" className="pb-2 text-center font-semibold">
                Edições
              </th>
              <th scope="col" className="pb-2 text-right font-semibold">
                Subtotal
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.nftId + item.editionId} className="border-t border-border" data-testid="receipt-item">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <NftImage image={item.image} sizes="40px" decorative className="size-10 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{item.name}</p>
                      <p className="text-[0.6875rem] text-muted-foreground">
                        {item.editionLabel} · Série {item.serial}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-2 text-center">
                  {item.quantity} × {formatEth(item.unitPrice)}
                </td>
                <td className="py-2 text-right font-semibold text-primary" data-testid="receipt-line-total">
                  {formatEth(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="flex flex-col gap-1.5 border-t border-border pt-3 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatEth(order.subtotal)}</dd>
          </div>
          {order.discount ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Desconto {order.couponCode ? `(${order.couponCode})` : ''}</dt>
              <dd>(-) {formatEth(order.discount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxas (serviço + rede {NETWORK_LABEL[order.network]})</dt>
            <dd data-testid="receipt-fees">{formatEth(order.serviceFee + order.networkFee)}</dd>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <dt>Total</dt>
            <dd className="text-primary" data-testid="receipt-total">
              {formatEth(order.total)}
            </dd>
          </div>
        </dl>
        <p className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-[0.6875rem] text-muted-foreground">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
          Transação simulada na rede {NETWORK_LABEL[order.network]}. A propriedade foi registrada para a carteira {shortAddress(order.wallet.address)}. Links e
          identificadores são fictícios.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {order.transaction ? (
            <Button asChild>
              <a href={order.transaction.explorerUrl} target="_blank" rel="noopener noreferrer">
                Ver no explorador (simulado) <ExternalLink size={14} />
              </a>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link to="/pedidos">Meus pedidos</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
