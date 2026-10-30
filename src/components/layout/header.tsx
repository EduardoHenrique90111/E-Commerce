import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { CircleUser, LogIn, LogOut, Search, ShoppingCart } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useCart } from '@/queries/cart'
import { logout, useSession } from '@/session/session'
import { cn } from '@/lib/utils'
import { ConnectionIndicator } from './connection-indicator'
import { Logo } from './logo'

const NAV = [
  { label: 'Início', to: '/', hash: undefined },
  { label: 'Mercado', to: '/', hash: 'catalogo' },
  { label: 'Criadores', to: '/', hash: 'criadores' },
  { label: 'Aprenda', to: '/', hash: 'diario' },
] as const

export function CartLink({ className }: { className?: string }) {
  const cart = useCart()
  const count = cart.data?.itemCount ?? 0
  return (
    <Link
      to="/carrinho"
      className={cn('relative inline-flex size-9 items-center justify-center rounded-md text-foreground hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', className)}
      aria-label={count ? `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}` : 'Carrinho vazio'}
      data-testid="header-cart"
    >
      <ShoppingCart size={19} />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] leading-4 font-bold text-primary-foreground" aria-hidden="true" data-testid="cart-count">
          {count}
        </span>
      ) : null}
    </Link>
  )
}

export function Header() {
  const { user, isAuthenticated } = useSession()
  const navigate = useNavigate()
  const { pathname, hash } = useRouterState({ select: (s) => ({ pathname: s.location.pathname, hash: s.location.hash }) })

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur">
      <div className="container-kurio flex h-14 items-center gap-4">
        <Logo />
        <nav aria-label="Principal" className="mx-auto hidden md:block">
          <ul className="flex items-center gap-7">
            {NAV.map((item) => {
              const active = pathname === '/' && (item.hash ? hash === item.hash : !hash)
              return (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    hash={item.hash}
                    className={cn(
                      'relative py-4 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
                      active && 'text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary',
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <ConnectionIndicator className="mr-1" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Buscar NFTs"
            onClick={() => {
              const input = document.getElementById('catalog-search') as HTMLInputElement | null
              if (input && pathname === '/') {
                input.focus()
                input.scrollIntoView({ block: 'center' })
              } else void navigate({ to: '/', hash: 'catalogo', search: { focus: 1 } })
            }}
          >
            <Search size={19} />
          </Button>
          <CartLink />
          {isAuthenticated && user ? (
            <div className="hidden items-center gap-1 md:flex">
              <Link to="/perfil" className="ml-1 inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" data-testid="header-account">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" width={24} height={24} className="size-6 rounded-full object-cover" />
                ) : (
                  <CircleUser size={20} />
                )}
                <span className="max-w-28 truncate">{user.displayName}</span>
              </Link>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Sair da conta"
                title="Sair"
                onClick={async () => {
                  await logout()
                  void navigate({ to: '/' })
                }}
              >
                <LogOut size={16} />
              </Button>
            </div>
          ) : (
            <Button asChild size="sm" className="ml-1 hidden md:inline-flex">
              <Link to="/entrar" search={{ redirect: pathname === '/entrar' ? undefined : pathname }}>
                <LogIn size={14} /> Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
