/**
 * Anúncios para leitores de tela (regiões aria-live globais renderizadas por <LiveAnnouncer/>).
 * Usado para feedback de mutations e alterações recebidas em tempo real.
 */
type Politeness = 'polite' | 'assertive'
type Listener = (message: string, politeness: Politeness) => void
const listeners = new Set<Listener>()

export function announce(message: string, politeness: Politeness = 'polite'): void {
  for (const l of listeners) l(message, politeness)
}

export function onAnnounce(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
