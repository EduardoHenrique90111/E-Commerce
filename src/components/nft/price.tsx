import { formatEth, spokenEth } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Price({ value, className, prefix }: { value: number; className?: string; prefix?: string }) {
  return (
    <span className={cn('font-bold text-primary tabular-nums', className)}>
      <span aria-hidden="true">
        {prefix}
        {formatEth(value)}
      </span>
      <span className="sr-only">
        {prefix}
        {spokenEth(value)}
      </span>
    </span>
  )
}
