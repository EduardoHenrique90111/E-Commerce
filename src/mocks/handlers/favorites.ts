import { http, HttpResponse, delay } from 'msw'
import type { FavoritesResponse } from '@/api/contracts'
import { getConfig } from '../config'
import { getDb, persist } from '../db'
import { toSummary } from '../domain'
import { apiError, requireAuth, simulateNetwork } from '../http'

function favoritesOf(userId: string): FavoritesResponse {
  const db = getDb()
  const ids = (db.favorites[userId] ?? []).filter((id) => db.nfts[id])
  return { ids, items: ids.map((id) => toSummary(db.nfts[id])) }
}

async function failIfConfigured(): Promise<Response | undefined> {
  if (!getConfig().favoritesFail) return undefined
  await delay(400)
  return apiError('SERVICE_UNAVAILABLE', 'Não foi possível atualizar seus favoritos agora. Tente novamente.')
}

export const favoritesHandlers = [
  http.get('/api/favorites', async ({ request }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    return HttpResponse.json(favoritesOf(auth.user.id))
  }),

  http.put('/api/favorites/:nftId', async ({ request, params }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const fail = await failIfConfigured()
    if (fail) return fail
    const db = getDb()
    const nftId = String(params.nftId)
    if (!db.nfts[nftId]) return apiError('NOT_FOUND', 'NFT não encontrado.')
    const list = (db.favorites[auth.user.id] ??= [])
    if (!list.includes(nftId)) list.unshift(nftId)
    persist()
    return HttpResponse.json(favoritesOf(auth.user.id))
  }),

  http.delete('/api/favorites/:nftId', async ({ request, params }) => {
    const net = await simulateNetwork(request)
    if (net) return net
    const auth = requireAuth(request)
    if (!auth.ok) return auth.response
    const fail = await failIfConfigured()
    if (fail) return fail
    const db = getDb()
    const nftId = String(params.nftId)
    db.favorites[auth.user.id] = (db.favorites[auth.user.id] ?? []).filter((id) => id !== nftId)
    persist()
    return HttpResponse.json(favoritesOf(auth.user.id))
  }),
]
