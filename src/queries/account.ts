import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Network, ProfileUpdate, Session, User, WalletCreate, WalletUpdate, WalletsResponse } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { useSession } from '@/session/session'
import { qk } from './keys'

export function useProfile() {
  const { user } = useSession()
  return useQuery({ queryKey: qk.profile(user?.id ?? 'anon'), queryFn: ({ signal }) => api.profile.get({ signal }), enabled: !!user })
}

function useSyncUser() {
  const qc = useQueryClient()
  return (user: User) => {
    qc.setQueryData(qk.profile(user.id), user)
    qc.setQueryData<Session | null>(qk.session, (s) => (s && s.user.id === user.id ? { ...s, user } : s))
  }
}

export function useUpdateProfile() {
  const sync = useSyncUser()
  return useMutation({ mutationFn: (body: ProfileUpdate) => api.profile.update(body), onSuccess: sync })
}

export function useUpdateAvatar() {
  const sync = useSyncUser()
  return useMutation({ mutationFn: (dataUrl: string) => api.profile.updateAvatar(dataUrl), onSuccess: sync })
}

export function useRemoveAvatar() {
  const sync = useSyncUser()
  return useMutation({ mutationFn: () => api.profile.removeAvatar(), onSuccess: sync })
}

export function useChangePassword() {
  return useMutation({ mutationFn: api.profile.changePassword })
}

export function useWallets() {
  const { user } = useSession()
  return useQuery({ queryKey: qk.wallets(user?.id ?? 'anon'), queryFn: ({ signal }) => api.wallets.list({ signal }), enabled: !!user })
}

export function useSaveWallet() {
  const qc = useQueryClient()
  const { user } = useSession()
  return useMutation({
    mutationFn: (input: { id?: string; body: WalletCreate | WalletUpdate }) =>
      input.id ? api.wallets.update(input.id, input.body as WalletUpdate) : api.wallets.create(input.body as WalletCreate),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.wallets(user?.id ?? 'anon') }),
  })
}

export function useWalletConnection() {
  const qc = useQueryClient()
  const { user } = useSession()
  const key = qk.wallets(user?.id ?? 'anon')
  const connect = useMutation({
    mutationFn: ({ walletId, network }: { walletId: string; network: Network }) => api.wallets.connect(walletId, network),
    onSuccess: (connection) =>
      qc.setQueryData<WalletsResponse>(key, (old) =>
        old ? { ...old, connection: { walletId: connection.walletId, network: connection.network, connectedAt: connection.connectedAt } } : old,
      ),
  })
  const disconnect = useMutation({
    mutationFn: (walletId: string) => api.wallets.disconnect(walletId),
    onSuccess: () => qc.setQueryData<WalletsResponse>(key, (old) => (old ? { ...old, connection: null } : old)),
  })
  return { connect, disconnect }
}
