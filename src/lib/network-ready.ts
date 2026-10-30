/**
 * Barreira de prontidão da camada de rede.
 *
 * A interface é montada imediatamente (o shell e os skeletons aparecem sem esperar o service
 * worker do MSW). As chamadas REST (Axios) e a conexão Socket.IO aguardam esta barreira:
 *  - com mocks ativos, ela é liberada quando o MSW intercepta REST e WebSocket;
 *  - sem mocks, é liberada já na inicialização.
 * Não há lógica de negócio nem respostas aqui — apenas a ordem de inicialização.
 */
let release!: () => void
const ready = new Promise<void>((resolve) => {
  release = resolve
})
let released = false

export function networkReady(): Promise<void> {
  return ready
}

export function isNetworkReady(): boolean {
  return released
}

export function markNetworkReady(): void {
  if (released) return
  released = true
  release()
}
