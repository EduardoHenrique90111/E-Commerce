import { Link, useRouterState } from '@tanstack/react-router'
import { CircleUser, Heart, House, Receipt, ShoppingCart } from '@/components/icons'
import { useCart } from '@/queries/cart'
import { cn } from '@/lib/utils'

/** Barra de navegação inferior (mobile), como no Figma. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  const items = [
    { to: '/', label: 'Início', icon: House, active: pathname === '/' },
    { to: '/favoritos', label: 'Favoritos', icon: Heart, active: pathname.startsWith('/favoritos') },
    { to: '/carrinho', label: 'Carrinho', icon: ShoppingCart, active: pathname.startsWith('/carrinho') || pathname.startsWith('/pagamento'), badge: count },
    { to: '/pedidos', label: 'Pedidos', icon: Receipt, active: pathname.startsWith('/pedidos') },
    { to: '/perfil', label: 'Conta', icon: CircleUser, active: pathname.startsWith('/perfil') || pathname.startsWith('/entrar') },
  ] as const
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon, active, ...rest }) => (
          <li key={to}>
            <Link
              to={to}
              className={cn('relative flex h-14 flex-col items-center justify-center gap-0.5 text-[0.625rem] text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset', active && 'text-primary')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={19} />
              {label}
              {'badge' in rest && rest.badge > 0 ? (
                <span className="absolute top-1.5 left-1/2 ml-2 rounded-full bg-primary px-1 text-[0.5625rem] leading-3.5 font-bold text-primary-foreground" aria-label={`${rest.badge} itens`}>
                  {rest.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
