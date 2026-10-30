import { useSyncExternalStore } from 'react'
import { getConnectionStatus, onConnectionStatus, type ConnectionStatus } from '@/realtime/notices'
import { cn } from '@/lib/utils'

const LABEL: Record<ConnectionStatus, string> = {
  idle: 'Tempo real inativo',
  connecting: 'Conectando ao tempo real…',
  connected: 'Tempo real conectado',
  reconnecting: 'Tempo real reconectando…',
  offline: 'Tempo real indisponível',
}

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(onConnectionStatus, getConnectionStatus, getConnectionStatus)
}

/** Indicador do estado da conexão Socket.IO (cor + texto acessível). */
export function ConnectionIndicator({ className, showLabel = false }: { className?: string; showLabel?: boolean }) {
  const status = useConnectionStatus()
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground', className)} data-testid="realtime-status" data-status={status} title={LABEL[status]}>
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          status === 'connected' && 'bg-success',
          (status === 'connecting' || status === 'reconnecting') && 'animate-pulse bg-warning',
          (status === 'offline' || status === 'idle') && 'bg-destructive',
        )}
      />
      <span className={showLabel ? '' : 'sr-only'}>{LABEL[status]}</span>
    </span>
  )
}
