import { useSyncExternalStore } from 'react'

/** Estado de uma media query (atualiza ao redimensionar). Valor inicial síncrono: sem piscar no primeiro quadro. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
