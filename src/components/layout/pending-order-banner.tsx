import { Link, useRouterState } from '@tanstack/react-router'
import { Clock } from '@/components/icons'
import { useOrder } from '@/queries/orders'
import { usePendingOrderId } from '@/features/checkout/pending-order'

/** Lembra o colecionador de um pedido pendente (recuperado após refresh ou reconexão). */
export function PendingOrderBanner() {
  const orderId = usePendingOrderId()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  if (!orderId || pathname.startsWith('/pedidos/')) return null
  return <Banner orderId={orderId} />
}

function Banner({ orderId }: { orderId: string }) {
  const order = useOrder(orderId)
  if (order.data?.status !== 'pending') return null
  return (
    <div className="border-b border-warning/40 bg-warning/10" role="status" data-testid="pending-order-banner">
      <div className="container-kurio flex flex-wrap items-center gap-2 py-2 text-xs">
        <Clock size={14} className="text-warning" />
        <span>
          O pedido <strong>{order.data.number}</strong> está aguardando confirmação da carteira.
        </span>
        <Link to="/pedidos/$orderId" params={{ orderId }} className="font-semibold text-primary underline-offset-4 hover:underline">
          Acompanhar pedido
        </Link>
      </div>
    </div>
  )
}
