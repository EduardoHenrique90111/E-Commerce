import { queryClient } from '@/app/query-client'
import { RealtimeClient } from './client'

/** Instância única do cliente de tempo real (ligada ao QueryClient da aplicação). */
export const realtime = new RealtimeClient(queryClient)
