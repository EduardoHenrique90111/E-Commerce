import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { CreateOrderRequest, Order } from '@/api/contracts'
import { quoteSchema } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { ApiError, toApiError } from '@/api/errors'
import { attemptFor, clearAttempt, loadAttempt } from '@/lib/idempotency'
import { qk } from '@/queries/keys'
import { setPendingOrder } from './pending-order'

export type PlaceOrderPhase = 'idle' | 'submitting' | 'recovering' | 'done' | 'failed'

export type PlaceOrderResult =
  | { ok: true; order: Order; replayed: boolean }
  | { ok: false; error: ApiError; freshQuote?: ReturnType<typeof quoteSchema.parse> }

const MAX_ATTEMPTS = 3

/**
 * Envio do pedido com proteção contra duplicidade:
 *  - trava contra cliques repetidos (ref síncrona);
 *  - chave de idempotência estável por conteúdo, persistida na sessão do navegador;
 *  - reenvio automático (mesma chave) após timeout / falha de rede / 5xx;
 *  - recuperação manual após refresh com a tentativa salva.
 */
export function usePlaceOrder(userId: string) {
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const [phase, setPhase] = useState<PlaceOrderPhase>('idle')
  const [attemptNumber, setAttemptNumber] = useState(0)

  const send = useCallback(
    async (payload: CreateOrderRequest, key: string): Promise<PlaceOrderResult> => {
      let lastError: ApiError | null = null
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        setAttemptNumber(attempt)
        setPhase(attempt === 1 ? 'submitting' : 'recovering')
        try {
          const order = await api.orders.create(payload, key)
          clearAttempt(userId)
          qc.setQueryData(qk.order(userId, order.id), order)
          void qc.invalidateQueries({ queryKey: qk.orders(userId) })
          if (order.status === 'pending') setPendingOrder(userId, order.id)
          setPhase('done')
          return { ok: true, order, replayed: attempt > 1 }
        } catch (err) {
          const e = toApiError(err)
          lastError = e
          if (!e.isTransient) break
          await new Promise((r) => setTimeout(r, 400 * attempt))
        }
      }
      setPhase('failed')
      const error = lastError ?? new ApiError({ kind: 'network', message: 'Falha ao enviar o pedido.' })
      if (error.code === 'QUOTE_STALE' || error.code === 'AVAILABILITY_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT') {
        clearAttempt(userId)
        const details = error.details as { quote?: unknown } | undefined
        const fresh = quoteSchema.safeParse(details?.quote)
        return { ok: false, error, freshQuote: fresh.success ? fresh.data : undefined }
      }
      return { ok: false, error }
    },
    [qc, userId],
  )

  const place = useCallback(
    async (payload: CreateOrderRequest): Promise<PlaceOrderResult | null> => {
      if (inFlight.current) return null // clique repetido enquanto o envio está em andamento
      inFlight.current = true
      try {
        const attempt = attemptFor(userId, payload)
        return await send(attempt.payload, attempt.key)
      } finally {
        inFlight.current = false
      }
    },
    [send, userId],
  )

  /** Retoma uma tentativa salva (ex.: refresh depois de um timeout). */
  const resume = useCallback(async (): Promise<PlaceOrderResult | null> => {
    const saved = loadAttempt<CreateOrderRequest>(userId)
    if (!saved || inFlight.current) return null
    inFlight.current = true
    try {
      return await send(saved.payload, saved.key)
    } finally {
      inFlight.current = false
    }
  }, [send, userId])

  return { place, resume, phase, attemptNumber, isBusy: phase === 'submitting' || phase === 'recovering', reset: () => setPhase('idle') }
}
