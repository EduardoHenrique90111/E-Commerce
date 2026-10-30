/** Variáveis públicas de ambiente (Vite). */
export const env = {
  mocksEnabled: import.meta.env.VITE_ENABLE_MOCKS === 'true',
  mockDevtools: import.meta.env.VITE_MOCK_DEVTOOLS === 'true',
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api',
  socketUrl: (import.meta.env.VITE_SOCKET_URL as string | undefined) || undefined,
  socketPath: (import.meta.env.VITE_SOCKET_PATH as string | undefined) || '/socket.io',
} as const
