/**
 * Cliente HTTP (Axios). Todas as chamadas REST passam por aqui.
 *  - injeta o token da sessão e o identificador do carrinho de visitante;
 *  - normaliza erros em ApiError;
 *  - notifica sessão inválida/expirada para o controlador de sessão.
 * Não contém respostas fictícias: os mocks atuam na camada de rede (MSW).
 */
import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { env } from '@/env'
import { isNetworkReady, networkReady } from '@/lib/network-ready'
import { guestCartStore, tokenStore } from '@/session/token-store'
import { HEADERS } from './contracts'
import { ApiError, toApiError } from './errors'

export const DEFAULT_TIMEOUT_MS = 10_000
/** Criação de pedido: timeout menor — a recuperação é feita por reenvio idempotente. */
export const ORDER_TIMEOUT_MS = 6_000

export const http = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
  // A API autentica por Bearer token: nenhum cookie é enviado (credentials: 'omit').
  // O adaptador fetch também evita que o MSW leia document.cookie a cada handler avaliado.
  adapter: 'fetch',
  withCredentials: false,
})

type AuthFailureListener = (error: ApiError) => void
const authFailureListeners = new Set<AuthFailureListener>()
export function onAuthFailure(listener: AuthFailureListener): () => void {
  authFailureListeners.add(listener)
  return () => authFailureListeners.delete(listener)
}

http.interceptors.request.use(async (config) => {
  // aguarda a camada de rede (MSW) na inicialização; o timeout do Axios só conta depois do envio
  if (!isNetworkReady()) await networkReady()
  const token = tokenStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  const guest = guestCartStore.get()
  if (!token && guest) config.headers.set(HEADERS.guestCart, guest)
  // o token enviado é guardado para ignorar 401 de uma sessão que já foi trocada
  ;(config as AxiosRequestConfig & { _token?: string | null })._token = token
  return config
})

http.interceptors.response.use(
  (response) => {
    const cartId = response.headers[HEADERS.guestCart.toLowerCase()] as string | undefined
    if (cartId?.startsWith('guest_') && !tokenStore.get()) guestCartStore.set(cartId)
    return response
  },
  (error: unknown) => {
    const apiError = toApiError(error)
    const sentToken = axios.isAxiosError(error) ? (error.config as (AxiosRequestConfig & { _token?: string | null }) | undefined)?._token : null
    if (apiError.isAuthError && sentToken && sentToken === tokenStore.get()) {
      for (const l of authFailureListeners) l(apiError)
    }
    return Promise.reject(apiError)
  },
)

/** Executa a requisição e valida a resposta com o schema do contrato. */
export async function request<S extends z.ZodTypeAny>(config: AxiosRequestConfig, schema: S): Promise<z.output<S>> {
  const response = await http.request<unknown>(config)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error('Contrato violado', config.url, parsed.error.issues)
    throw new ApiError({ kind: 'invalid-response', message: 'Resposta inesperada do servidor.', status: response.status })
  }
  return parsed.data
}

export async function requestVoid(config: AxiosRequestConfig): Promise<void> {
  await http.request(config)
}
