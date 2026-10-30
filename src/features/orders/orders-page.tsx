import { Link } from '@tanstack/react-router'
import { toApiError } from '@/api/errors'
import { Receipt, RefreshCw, TriangleAlert } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NETWORK_LABEL, ORDER_STATUS_LABEL, formatDateTime, formatEth } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import { useOrders } from '@/queries/orders'

export function OrdersPage() {
  usePageMeta({ title: 'Meus pedidos — Kurio' })
  const orders = useOrders()
  return (
    <section aria-labelledby="orders-title" className="flex flex-col gap-4">
      <h1 id="orders-title" className="text-sm font-bold">
        Meus pedidos
      </h1>
      {orders.isPending ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : orders.isError ? (
        <Alert variant="destructive" role="alert">
          <TriangleAlert size={16} />
          <div className="flex flex-col gap-2">
            <AlertDescription>{toApiError(orders.error).message}</AlertDescription>
            <Button size="sm" variant="outline" onClick={() => void orders.refetch()}>
              <RefreshCw size={14} /> Tentar novamente
            </Button>
          </div>
        </Alert>
      ) : orders.data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <Receipt size={28} className="text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Você ainda não fez pedidos.</p>
          <Button asChild size="sm">
            <Link to="/" hash="catalogo">
              Explorar NFTs
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="orders-list">
          {orders.data.items.map((o) => (
            <li key={o.id}>
              <Link
                to="/pedidos/$orderId"
                params={{ orderId: o.id }}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-surface p-3 text-xs transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className="font-bold">{o.number}</span>
                <Badge variant={o.status === 'confirmed' ? 'success' : o.status === 'rejected' ? 'destructive' : 'warning'}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                <span className="text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                <span className="text-muted-foreground">
                  {o.itemCount} {o.itemCount === 1 ? 'item' : 'itens'} · {NETWORK_LABEL[o.network]}
                </span>
                <span className="ml-auto font-bold text-primary">{formatEth(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
