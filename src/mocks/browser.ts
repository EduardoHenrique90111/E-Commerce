/**
 * Inicialização da camada de mocks no navegador (desenvolvimento, demonstração e testes).
 * Carregado sob demanda pelo main.tsx apenas quando VITE_ENABLE_MOCKS=true.
 */
import { setupWorker } from 'msw/browser'
import { initConfig } from './config'
import { createControl, type KurioMockControl } from './control'
import { DB_KEY, loadDb, reloadDbFromStorage, resetDb } from './db'
import { resumePendingOrders } from './domain'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { favoritesHandlers } from './handlers/favorites'
import { miscHandlers } from './handlers/misc'
import { orderHandlers } from './handlers/orders'
import { createRealtimeHandler, startRealtimeDelivery } from './realtime'

declare global {
  interface Window {
    __KURIO_MOCK__?: KurioMockControl
  }
}

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...favoritesHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  ...miscHandlers,
]

export async function startMocks(): Promise<void> {
  const { resetRequested } = initConfig()
  loadDb()
  if (resetRequested) resetDb()
  resumePendingOrders()
  startRealtimeDelivery()

  // consistência entre abas: outra aba gravou o estado simulado
  window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY) {
      reloadDbFromStorage()
      resumePendingOrders()
    }
  })

  const worker = setupWorker(...handlers, createRealtimeHandler())
  await worker.start({
    serviceWorker: { url: '/mockServiceWorker.js' },
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
  window.__KURIO_MOCK__ = createControl()
  document.documentElement.dataset.mocks = 'ready'
}
