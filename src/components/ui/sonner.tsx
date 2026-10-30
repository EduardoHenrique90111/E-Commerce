import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** Notificações (sonner) — anunciadas por leitores de tela via região aria-live. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      closeButton
      containerAriaLabel="Notificações"
      toastOptions={{
        style: { background: 'var(--surface-2)', color: 'var(--foreground)', border: '1px solid var(--border)', fontFamily: 'var(--font-sans)' },
      }}
      {...props}
    />
  )
}

export { Toaster }
