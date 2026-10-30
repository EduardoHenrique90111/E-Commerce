import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from '@/components/icons'

/** Select nativo estilizado (melhor acessibilidade e UX em mobile). */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          'h-10 w-full appearance-none rounded-md border border-input bg-surface py-2 pr-9 pl-3 text-sm text-foreground outline-none',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { NativeSelect }
