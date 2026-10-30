/**
 * Resolve quando o navegador fica ocioso (ou após `timeout` ms).
 * Usado para tirar do caminho crítico da carga inicial trabalho que não afeta o primeiro conteúdo,
 * como a conexão de tempo real e o painel de simulação.
 */
export function whenIdle(timeout = 2000): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout })
    else setTimeout(resolve, 200)
  })
}
