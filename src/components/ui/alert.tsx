import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva('relative flex w-full gap-3 rounded-md border px-4 py-3 text-xs [&>svg]:mt-0.5 [&>svg]:shrink-0', {
  variants: {
    variant: {
      default: 'border-border bg-surface-2 text-foreground',
      info: 'border-primary/40 bg-primary/10 text-foreground [&>svg]:text-primary',
      warning: 'border-warning/50 bg-warning/10 text-foreground [&>svg]:text-warning',
      destructive: 'border-destructive/50 bg-destructive/10 text-foreground [&>svg]:text-destructive',
      success: 'border-success/40 bg-success/10 text-foreground [&>svg]:text-success',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Alert({ className, variant, ...props }: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role={props.role ?? 'status'} className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('font-bold', className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('text-muted-foreground [&_p]:leading-relaxed', className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
