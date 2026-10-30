import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { emailSchema } from '@/api/contracts'
import { getDb, persist } from '../db'
import { apiError, parseBody, simulateNetwork } from '../http'

export const miscHandlers = [
  http.post('/api/newsletter', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const parsed = await parseBody(request, z.object({ email: emailSchema }))
    if (!parsed.ok) return parsed.response
    const db = getDb()
    const key = `newsletter:${parsed.data.email.toLowerCase()}`
    if (db.counters[key]) return apiError('CONFLICT', 'Este e-mail já está inscrito.', { fieldErrors: { email: 'Este e-mail já está inscrito.' } })
    db.counters[key] = 1
    persist()
    return new HttpResponse(null, { status: 204 })
  }),
]
