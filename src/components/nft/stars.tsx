import { Star } from '@/components/icons'

export function Stars({ rating, count }: { rating: number; count?: number }) {
  const full = Math.round(rating)
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="flex text-primary" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={13} fill={i < full ? 'currentColor' : 'none'} />
        ))}
      </span>
      <span className="sr-only">Nota {rating.toLocaleString('pt-BR')} de 5.</span>
      {count !== undefined ? <span>({count} avaliações de colecionadores)</span> : null}
    </span>
  )
}
