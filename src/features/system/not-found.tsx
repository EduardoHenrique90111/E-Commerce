import { Link, type ErrorComponentProps } from '@tanstack/react-router'
import { TriangleAlert } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { usePageMeta } from '@/lib/page-meta'

export function NotFoundPage() {
  usePageMeta({ title: 'Página não encontrada — Kurio' })
  return (
    <section className="container-kurio flex flex-col items-center gap-4 py-24 text-center" aria-labelledby="nf-title" data-testid="not-found">
      <p className="text-5xl font-extrabold text-primary" aria-hidden="true">
        404
      </p>
      <h1 id="nf-title" className="text-lg font-bold">
        Página não encontrada
      </h1>
      <p className="max-w-md text-xs text-muted-foreground">O endereço acessado não existe ou foi movido. Verifique o link ou volte ao catálogo.</p>
      <div className="flex gap-2">
        <Button asChild>
          <Link to="/">Ir para o início</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/" hash="catalogo">
            Explorar NFTs
          </Link>
        </Button>
      </div>
    </section>
  )
}

export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  return (
    <section className="container-kurio flex flex-col items-center gap-4 py-24 text-center" role="alert">
      <TriangleAlert size={36} className="text-destructive" />
      <h1 className="text-lg font-bold">Algo deu errado</h1>
      <p className="max-w-md text-xs text-muted-foreground">{error instanceof Error ? error.message : 'Erro inesperado.'}</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </section>
  )
}
