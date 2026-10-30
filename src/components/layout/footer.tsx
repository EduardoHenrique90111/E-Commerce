import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { http } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { Bell, ShieldCheck, Users } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { announce } from '@/lib/announce'
import { COLLECTION_LABEL } from '@/lib/format'

const FEATURES = [
  { icon: ShieldCheck, title: 'Segurança de carteira', text: 'Proteja sua carteira e colecione arte digital certificada com confiança.', id: undefined },
  { icon: Users, title: 'Criadores em destaque', text: 'Conheça artistas, músicos e comunidades que moldam a cultura digital.', id: 'criadores' },
  { icon: Bell, title: 'Alertas de lançamento', text: 'Receba avisos de drops, edições limitadas e coleções antes de todo mundo.', id: undefined },
]

function Newsletter() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = z.string().trim().email('Informe um e-mail válido.').safeParse(email)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setError(undefined)
    setLoading(true)
    try {
      await http.post('/newsletter', { email: parsed.data })
      setEmail('')
      toast.success('Inscrição confirmada', { description: 'Você receberá os próximos lançamentos por e-mail.' })
      announce('Inscrição na newsletter confirmada.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2" aria-labelledby="newsletter-title">
      <h2 id="newsletter-title" className="text-xs font-bold text-foreground">
        Inscreva-se nos próximos lançamentos
      </h2>
      <div className="flex">
        <label htmlFor="newsletter-email" className="sr-only">
          Seu e-mail
        </label>
        <Input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          placeholder="Digite seu e-mail..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'newsletter-error' : 'newsletter-hint'}
          className="h-9 rounded-r-none text-xs"
        />
        <Button type="submit" size="sm" className="h-9 rounded-l-none" loading={loading}>
          Enviar
        </Button>
      </div>
      {error ? (
        <p id="newsletter-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p id="newsletter-hint" className="text-[0.6875rem] text-subtle-foreground">
          Novos lançamentos exclusivos, entrevistas com criadores e novidades da comunidade.
        </p>
      )}
    </form>
  )
}

export function Footer() {
  return (
    <footer className="mt-16 pb-20 md:pb-8">
      <div className="container-kurio">
        <section aria-label="Por que colecionar na Kurio" className="grid gap-6 rounded-t-lg bg-surface p-6 md:grid-cols-[repeat(3,1fr)_1.2fr] md:divide-x md:divide-primary/30">
          {FEATURES.map(({ icon: Icon, title, text, id }) => (
            <div key={title} id={id} className="flex flex-col gap-2 md:pr-6 md:not-first:pl-6 scroll-mt-24">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
                <Icon size={18} />
              </span>
              <h2 className="text-xs font-bold">{title}</h2>
              <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
          <div className="md:pl-6">
            <Newsletter />
          </div>
        </section>
        <div className="grid gap-3 bg-band px-6 py-4 text-xs sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
          <span className="font-extrabold tracking-[0.25em]">KURIO</span>
          <span className="text-foreground/90">Feito para colecionadores, criadores e cultura.</span>
          <span className="text-foreground/90">contato@kurio.dev</span>
          <span className="text-foreground/90">+55 11 4000-2026</span>
        </div>
        <div className="grid grid-cols-2 gap-6 rounded-b-lg bg-surface p-6 text-xs md:grid-cols-4">
          <nav aria-labelledby="footer-profile">
            <h2 id="footer-profile" className="mb-2 font-bold">
              Meu perfil
            </h2>
            <ul className="flex flex-col gap-1.5 text-muted-foreground">
              <li><Link to="/perfil" className="hover:text-primary">Meu perfil</Link></li>
              <li><Link to="/favoritos" className="hover:text-primary">Minha coleção</Link></li>
              <li><Link to="/pedidos" className="hover:text-primary">Atividade</Link></li>
              <li><Link to="/perfil/carteiras" className="hover:text-primary">Carteiras</Link></li>
              <li><Link to="/favoritos" className="hover:text-primary">Lista de desejos</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-help">
            <h2 id="footer-help" className="mb-2 font-bold">
              Central de ajuda
            </h2>
            <ul className="flex flex-col gap-1.5 text-muted-foreground">
              <li><Link to="/" hash="diario" className="hover:text-primary">Como comprar NFTs</Link></li>
              <li><Link to="/" hash="diario" className="hover:text-primary">Carteiras e segurança</Link></li>
              <li><Link to="/" hash="diario" className="hover:text-primary">Raridade e procedência</Link></li>
              <li><Link to="/pedidos" className="hover:text-primary">Acompanhar pedidos</Link></li>
            </ul>
          </nav>
          <nav aria-labelledby="footer-collections">
            <h2 id="footer-collections" className="mb-2 font-bold">
              Coleções
            </h2>
            <ul className="flex flex-col gap-1.5 text-muted-foreground">
              {(['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis'] as const).map((c) => (
                <li key={c}>
                  <Link to="/" search={{ col: c }} hash="catalogo" className="hover:text-primary">
                    {COLLECTION_LABEL[c]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="mb-2 font-bold">Carteiras compatíveis</h2>
            <ul className="flex flex-wrap gap-1.5" aria-label="Carteiras compatíveis">
              {['MetaMask', 'Coinbase', 'Phantom', 'WalletConnect'].map((w) => (
                <li key={w} className="rounded bg-band px-2 py-1 text-[0.625rem] font-bold tracking-wide text-primary uppercase">
                  {w}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.6875rem] text-subtle-foreground">Demonstração: dados, pagamentos e carteiras são simulados.</p>
          </div>
        </div>
        <p className="mt-4 text-center text-[0.6875rem] text-subtle-foreground">© 2026 Kurio. Propriedade digital para todos.</p>
      </div>
    </footer>
  )
}
