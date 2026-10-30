import { lazy, Suspense } from 'react'
import { Outlet, ScrollRestoration } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { env } from '@/env'
import { Footer } from './footer'
import { Header } from './header'
import { LiveAnnouncer } from './live-announcer'
import { MobileNav } from './mobile-nav'
import { PendingOrderBanner } from './pending-order-banner'
import { RealtimeBridge } from './realtime-bridge'
import { SessionWatcher } from './session-watcher'

const MockDevtools = env.mocksEnabled && env.mockDevtools ? lazy(() => import('@/mocks/devtools/mock-devtools')) : null

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
      <ScrollRestoration />
      {MockDevtools ? (
        <Suspense fallback={null}>
          <MockDevtools />
        </Suspense>
      ) : null}
    </>
  )
}
