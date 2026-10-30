import type * as React from 'react'
import { cn } from '@/lib/utils'

/** Skeleton com shimmer; mantém as dimensões do conteúdo final para evitar CLS. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn('skeleton', className)} {...props} />
}

export { Skeleton }
