import { Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { CircleUser, Heart, LogOut, Receipt, Wallet } from '@/components/icons'
import { logout, useSession } from '@/session/session'
import { cn } from '@/lib/utils'

const LINKS = [
  { to: '/perfil', label: 'Dados do perfil', icon: CircleUser, match: (p: string) => p === '/perfil' },
  { to: '/perfil/carteiras', label: 'Carteiras', icon: Wallet, match: (p: string) => p.startsWith('/perfil/carteiras') },
  { to: '/favoritos', label: 'Lista de desejos', icon: Heart, match: (p: string) => p.startsWith('/favoritos') },
  { to: '/pedidos', label: 'Pedidos', icon: Receipt, match: (p: string) => p === '/pedidos' },
] as const

/** Layout da conta do colecionador (menu lateral "Meu perfil" do Figma). */
export function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()
  const { user } = useSession()
  return (
    <div className="container-kurio grid grid-cols-1 gap-6 pt-6 md:grid-cols-[200px_minmax(0,1fr)] md:pt-8">
      <aside className="h-fit min-w-0 rounded-lg bg-surface p-3" aria-label="Menu da conta">
        <p className="mb-2 px-2 text-xs font-bold">Meu perfil</p>
        {user ? <p className="mb-3 truncate px-2 text-[0.6875rem] text-muted-foreground">{user.email}</p> : null}
        <nav aria-label="Seções da conta">
          <ul className="flex gap-1 overflow-x-auto md:flex-col">
            {LINKS.map(({ to, label, icon: Icon, match }) => {
              const active = match(pathname)
              return (
                <li key={to} className="shrink-0">
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                      active && 'border-primary bg-primary/10 text-primary',
                    )}
                  >
                    <Icon size={14} />
                    {label}
                  </Link>
                </li>
              )
            })}
            <li className="shrink-0">
              <button
                type="button"
                onClick={async () => {
                  await logout()
                  void navigate({ to: '/' })
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                data-testid="logout-button"
              >
                <LogOut size={14} /> Sair
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
