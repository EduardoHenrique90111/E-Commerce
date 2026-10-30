import * as React from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FieldProps {
  id: string
  label: React.ReactNode
  required?: boolean
  error?: string
  description?: React.ReactNode
  className?: string
  children: (props: { id: string; 'aria-invalid': boolean | undefined; 'aria-describedby': string | undefined; 'aria-required': boolean | undefined }) => React.ReactNode
}

/** Campo de formulário com label, descrição e erro associados (aria-describedby / aria-invalid). */
function Field({ id, label, required, error, description, className, children }: FieldProps) {
  const descId = description ? `${id}-desc` : undefined
  const errId = error ? `${id}-error` : undefined
  const describedBy = [descId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)} data-invalid={error ? true : undefined}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-primary" aria-hidden="true">
            *
          </span>
        ) : null}
        {required ? <span className="sr-only">(obrigatório)</span> : null}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {description ? (
        <p id={descId} className="text-[0.6875rem] text-subtle-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errId} className="flex items-start gap-1 text-xs text-destructive" role="alert">
          <span aria-hidden="true">⚠</span> {error}
        </p>
      ) : null}
    </div>
  )
}

export { Field }
