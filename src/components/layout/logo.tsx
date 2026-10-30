import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-sm font-extrabold tracking-[0.25em] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm', className)} aria-label="Kurio — página inicial">
      KURIO
    </Link>
  )
}
