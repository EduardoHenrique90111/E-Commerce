import './styles/globals.css'
import { env } from './env'
import { markNetworkReady } from './lib/network-ready'
import { takeMockUrlParams } from './mocks/url-params'

/**
 * Inicialização.
 *
 * Com VITE_ENABLE_MOCKS=true a camada MSW (REST + Socket.IO) é carregada em paralelo à aplicação.
 * A interface é montada sem esperar o service worker; as requisições REST e a conexão de tempo real
 * aguardam a barreira `networkReady()`, de modo que nenhuma chamada escapa para a rede real antes
 * de os mocks estarem ativos.
 */
async function enableMocking(): Promise<void> {
  if (!env.mocksEnabled) return
  const params = takeMockUrlParams()
  const { startMocks } = await import('./mocks/browser')
  await startMocks(params)
}

enableMocking()
  .catch((error: unknown) => {
    // sem a simulação as requisições falham e a interface exibe os estados de erro
    console.error('Falha ao iniciar a camada de mocks', error)
  })
  .finally(markNetworkReady)

const app = await import('./bootstrap')
app.mount(document.getElementById('root')!)
