/**
 * Rotas (TanStack Router, definidas em código).
 *  - parâmetros de busca validados e tipados (catálogo, login);
 *  - rotas privadas sob o layout `_auth` com `beforeLoad` que exige sessão e guarda o retorno;
 *  - páginas fora do caminho crítico são carregadas sob demanda (code splitting);
 *  - rotas inexistentes caem no notFoundComponent.
 */
import { createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { RootLayout } from '@/components/layout/root-layout'
import { HomePage } from '@/features/catalog/home-page'
import { validateCatalogSearch } from '@/features/catalog/search'
import { NftDetailPage } from '@/features/nft/nft-detail-page'
import { NotFoundPage, RouteErrorPage } from '@/features/system/not-found'
import { catalogQueryOptions, nftQueryOptions } from '@/queries/catalog'
import { toCatalogQuery } from '@/features/catalog/search'
import { sessionQueryOptions } from '@/session/session'

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateCatalogSearch,
  loaderDeps: ({ search }) => toCatalogQuery(search),
  // inicia a busca em paralelo à renderização (os componentes mostram skeletons)
  loader: ({ context, deps }) => void context.queryClient.prefetchQuery(catalogQueryOptions(deps)),
  component: function HomeRoute() {
    return <HomePage search={indexRoute.useSearch()} />
  },
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  loader: ({ context, params }) => void context.queryClient.prefetchQuery(nftQueryOptions(params.nftId)),
  component: function NftRoute() {
    const { nftId } = nftRoute.useParams()
    return <NftDetailPage nftId={nftId} />
  },
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/features/cart/cart-page'), 'CartPage'),
})

export interface AuthSearch {
  redirect?: string
  reason?: 'expired'
}
const validateAuthSearch = (raw: Record<string, unknown>): AuthSearch => ({
  redirect: typeof raw.redirect === 'string' && raw.redirect.startsWith('/') ? raw.redirect : undefined,
  reason: raw.reason === 'expired' ? 'expired' : undefined,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/entrar',
  validateSearch: validateAuthSearch,
  component: lazyRouteComponent(() => import('@/features/auth/auth-pages'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: validateAuthSearch,
  component: lazyRouteComponent(() => import('@/features/auth/auth-pages'), 'RegisterPage'),
})

/** Layout sem caminho que protege as rotas privadas. */
const authLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: '_auth',
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions())
    if (!session) {
      throw redirect({ to: '/entrar', search: { redirect: location.href } })
    }
    return { session }
  },
})

const checkoutRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/pagamento',
  component: lazyRouteComponent(() => import('@/features/checkout/checkout-page'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => authLayout,
  path: '/pedidos/$orderId',
  component: lazyRouteComponent(() => import('@/features/orders/order-page'), 'OrderPage'),
})

const accountLayout = createRoute({
  getParentRoute: () => authLayout,
  id: '_account',
  component: lazyRouteComponent(() => import('@/features/account/account-layout'), 'AccountLayout'),
})

const profileRoute = createRoute({
  getParentRoute: () => accountLayout,
  path: '/perfil',
  component: lazyRouteComponent(() => import('@/features/account/profile-page'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => accountLayout,
  path: '/perfil/carteiras',
  component: lazyRouteComponent(() => import('@/features/account/wallets-page'), 'WalletsPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => accountLayout,
  path: '/favoritos',
  component: lazyRouteComponent(() => import('@/features/account/favorites-page'), 'FavoritesPage'),
})

const ordersRoute = createRoute({
  getParentRoute: () => accountLayout,
  path: '/pedidos',
  component: lazyRouteComponent(() => import('@/features/orders/orders-page'), 'OrdersPage'),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  nftRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  authLayout.addChildren([checkoutRoute, orderRoute, accountLayout.addChildren([profileRoute, walletsRoute, favoritesRoute, ordersRoute])]),
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingMinMs: 0,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
