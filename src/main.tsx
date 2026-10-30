import './styles/globals.css'
import { env } from './env'

/**
 * Inicialização: com VITE_ENABLE_MOCKS=true a camada MSW (REST + Socket.IO) é iniciada antes
 * da aplicação, para que nenhuma requisição escape para a rede real.
 */
async function enableMocking() {
  if (!env.mocksEnabled) return
  const { startMocks } = await import('./mocks/browser')
  await startMocks()
}

const [, app] = await Promise.all([enableMocking(), import('./bootstrap')])
app.mount(document.getElementById('root')!)
