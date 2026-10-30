import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { useFavorites, useToggleFavorite } from '@/queries/favorites'
import { useSession } from '@/session/session'
import { cn } from '@/lib/utils'

interface Props {
  nftId: string
  name: string
  variant?: 'icon' | 'full' | 'overlay'
  className?: string
}

/** Favoritar exige login: visitantes são levados ao login e voltam para a mesma página. */
export function FavoriteButton({ nftId, name, variant = 'icon', className }: Props) {
  const { isAuthenticated } = useSession()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const active = !!favorites.data?.ids.includes(nftId)
  const label = active ? `Remover ${name} dos favoritos` : `Favoritar ${name}`

  const onClick = () => {
    if (!isAuthenticated) {
      void navigate({ to: '/entrar', search: { redirect: href } })
      return
    }
    toggle.mutate({ nftId, favorite: !active, name })
  }

  if (variant === 'full') {
    return (
      <Button type="button" variant="outline" onClick={onClick} aria-pressed={active} className={className}>
        <Heart size={16} fill={active ? 'currentColor' : 'none'} />
        {active ? 'Favoritado' : 'Favoritar'}
      </Button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        variant === 'overlay' ? 'bg-background/80 text-foreground backdrop-blur hover:bg-background' : 'border border-border bg-surface hover:bg-surface-2',
        active && 'text-primary',
        className,
      )}
    >
      <Heart size={16} fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}
