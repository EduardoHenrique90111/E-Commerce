import { useEffect, useState } from 'react'
import { onAnnounce } from '@/lib/announce'

/** Regiões aria-live globais (educada e assertiva) usadas por announce(). */
export function LiveAnnouncer() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')
  useEffect(
    () =>
      onAnnounce((message, politeness) => {
        const set = politeness === 'assertive' ? setAssertive : setPolite
        // limpa antes para que mensagens repetidas sejam anunciadas novamente
        set('')
        window.setTimeout(() => set(message), 60)
      }),
    [],
  )
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-assertive">
        {assertive}
      </div>
    </>
  )
}
