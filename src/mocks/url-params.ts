/**
 * Lê e remove da URL os parâmetros de controle da simulação (`?scenario=` e `?reset=1`).
 *
 * Roda de forma síncrona antes da criação do router, para que esses parâmetros não entrem no
 * estado de navegação; a aplicação de fato acontece em `initConfig()` quando o MSW carrega.
 */
export interface MockUrlParams {
  scenario: string | null
  reset: boolean
}

export function takeMockUrlParams(): MockUrlParams {
  const url = new URL(window.location.href)
  const scenario = url.searchParams.get('scenario')
  const reset = url.searchParams.get('reset') === '1'
  if (scenario !== null || url.searchParams.has('reset')) {
    url.searchParams.delete('scenario')
    url.searchParams.delete('reset')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }
  return { scenario, reset }
}
