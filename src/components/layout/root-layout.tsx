import { lazy, Suspense } from 'react'
import { Outlet } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { env } from '@/env'
import { whenIdle } from '@/lib/idle'
import { networkReady } from '@/lib/network-ready'
import { Footer } from './footer'
import { Header } from './header'
import { LiveAnnouncer } from './live-announcer'
import { MobileNav } from './mobile-nav'
import { PendingOrderBanner } from './pending-order-banner'
import { RealtimeBridge } from './realtime-bridge'
import { SessionWatcher } from './session-watcher'

// o painel depende da API de controle (window.__KURIO_MOCK__), disponível quando o MSW inicia
const MockDevtools =
  env.mocksEnabled && env.mockDevtools
    ? lazy(() =>
        networkReady()
          .then(() => whenIdle())
          .then(() => import('@/mocks/devtools/mock-devtools')),
      )
    : null
/** Os testes de regressão visual ocultam o painel (localStorage "kurio:mock:devtools" = "off"). */
const devtoolsHidden = () => {
  try {
    return localStorage.getItem('kurio:mock:devtools') === 'off'
  } catch {
    return false
  }
}

export function RootLayout() {
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-[60] rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Pular para o conteúdo
      </a>
      <Header />
      <PendingOrderBanner />
      <main id="conteudo" tabIndex={-1} className="min-h-[60vh] outline-none">
        <Outlet />
      </main>
      <Footer />
      <MobileNav />
      <Toaster />
      <LiveAnnouncer />
      <SessionWatcher />
      <RealtimeBridge />
      {MockDevtools && !devtoolsHidden() ? (
        <Suspense fallback={null}>
          <MockDevtools />
        </Suspense>
      ) : null}
    </>
  )
}
