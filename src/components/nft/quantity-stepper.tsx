import { Minus, Plus } from '@/components/icons'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
  id?: string
}

/** Seletor de quantidade acessível (botões com rótulo + valor anunciado). */
export function QuantityStepper({ value, min = 1, max, onChange, label, disabled, size = 'md', id }: Props) {
  const btn = cn(
    'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-subtle-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none',
    size === 'sm' ? 'size-7' : 'size-9',
  )
  return (
    <div className="inline-flex items-center gap-2" role="group" aria-label={label} id={id}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label={`Diminuir quantidade de ${label}`}>
        <Minus size={14} strokeWidth={3} />
      </button>
      <output className={cn('min-w-6 text-center font-bold tabular-nums', size === 'sm' ? 'text-xs' : 'text-sm')} aria-live="polite" aria-label={`Quantidade: ${value}`}>
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Aumentar quantidade de ${label}`}>
        <Plus size={14} strokeWidth={3} />
      </button>
    </div>
  )
}
