import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { FavoritesResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { announce } from '@/lib/announce'
import { useSession } from '@/session/session'
import { qk } from './keys'

export function useFavorites() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.favorites(user?.id ?? 'anon'),
    queryFn: ({ signal }) => api.favorites.list({ signal }),
    enabled: !!user,
  })
}

/**
 * Favoritar/desfavoritar com atualização otimista: a interface muda na hora e,
 * se a API falhar, o estado anterior é restaurado e o usuário é avisado.
 */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const { user } = useSession()
  const key = qk.favorites(user?.id ?? 'anon')
  return useMutation({
    mutationKey: ['favorites', 'toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? api.favorites.add(nftId) : api.favorites.remove(nftId),
    onMutate: async ({ nftId, favorite, name }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      const base = previous ?? { ids: [], items: [] }
      qc.setQueryData<FavoritesResponse>(key, {
        ids: favorite ? [nftId, ...base.ids.filter((id) => id !== nftId)] : base.ids.filter((id) => id !== nftId),
        items: favorite ? base.items : base.items.filter((i) => i.id !== nftId),
      })
      announce(favorite ? `${name} adicionado aos favoritos.` : `${name} removido dos favoritos.`)
      return { previous }
    },
    onError: (error, { name, favorite }, context) => {
      qc.setQueryData(key, context?.previous)
      const message = toApiError(error).message
      toast.error(favorite ? `Não foi possível favoritar ${name}` : `Não foi possível remover ${name} dos favoritos`, { description: message })
      announce(`Falha ao atualizar favoritos. ${message} O estado anterior foi restaurado.`, 'assertive')
    },
    onSuccess: (data) => qc.setQueryData(key, data),
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  })
}
