import { isAxiosError } from 'axios'
import { apiErrorBodySchema, type ErrorCode } from './contracts'

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'canceled' | 'invalid-response'

/** Erro normalizado da API, independente do transporte. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: ErrorCode | null
  readonly fieldErrors: Record<string, string>
  readonly details: unknown
  readonly retryable: boolean

  constructor(init: {
    kind: ApiErrorKind
    message: string
    status?: number | null
    code?: ErrorCode | null
    fieldErrors?: Record<string, string>
    details?: unknown
    retryable?: boolean
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? null
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details
    this.retryable = init.retryable ?? false
  }

  get isAuthError(): boolean {
    return this.code === 'SESSION_EXPIRED' || this.code === 'UNAUTHENTICATED'
  }

  /** Falha transitória: pode ser repetida com segurança (GET ou mutation idempotente). */
  get isTransient(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.retryable || (this.status !== null && this.status >= 500)
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    if (error.code === 'ERR_CANCELED') return new ApiError({ kind: 'canceled', message: 'Requisição cancelada.' })
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: 'O servidor demorou para responder.', retryable: true })
    }
    if (!error.response) {
      return new ApiError({ kind: 'network', message: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.', retryable: true })
    }
    const parsed = apiErrorBodySchema.safeParse(error.response.data)
    if (parsed.success) {
      const e = parsed.data.error
      return new ApiError({
        kind: 'http',
        status: error.response.status,
        code: e.code,
        message: e.message,
        fieldErrors: e.fieldErrors,
        details: e.details,
        retryable: e.retryable,
      })
    }
    return new ApiError({
      kind: 'http',
      status: error.response.status,
      message: error.response.status >= 500 ? 'Falha temporária no servidor. Tente novamente.' : 'Não foi possível concluir a operação.',
      retryable: error.response.status >= 500,
    })
  }
  if (error instanceof Error && error.name === 'ZodError') {
    return new ApiError({ kind: 'invalid-response', message: 'Resposta inesperada do servidor.' })
  }
  return new ApiError({ kind: 'network', message: error instanceof Error ? error.message : 'Erro inesperado.' })
}

/** Mensagem amigável para exibir ao usuário. */
export function errorMessage(error: unknown): string {
  return toApiError(error).message
}
