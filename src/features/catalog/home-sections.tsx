import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { NftImage } from '@/components/nft/nft-image'

const BANNERS = [
  {
    id: 'emerald-ape-042',
    title: 'Lançamentos de edição limitada',
    text: 'Coleções exclusivas, poucas edições e procedência verificada diretamente com os criadores.',
    cta: 'Ver edições',
    search: { sort: 'newest' as const },
  },
  {
    id: 'onyx-mogul-102',
    title: 'Arte digital',
    text: 'Explore obras únicas de criadores verificados e monte uma coleção com identidade.',
    cta: 'Explorar',
    search: { col: 'arte-digital' },
  },
]

export function LaunchBanners() {
  return (
    <section aria-label="Lançamentos" className="container-kurio mt-14 grid gap-4 md:grid-cols-2">
      {BANNERS.map((b) => (
        <article key={b.id} className="grid grid-cols-[40%_1fr] overflow-hidden rounded-lg bg-surface">
          <NftImage image={{ base: `/images/nfts/${b.id}`, alt: '' }} sizes="(min-width: 768px) 220px, 40vw" decorative className="h-full rounded-none" />
          <div className="flex flex-col items-start justify-center gap-2 p-4">
            <h2 className="text-sm leading-snug font-bold">{b.title}</h2>
            <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">{b.text}</p>
            <Button asChild size="sm" className="mt-1">
              <Link to="/" search={b.search} hash="catalogo">
                {b.cta}
              </Link>
            </Button>
          </div>
        </article>
      ))}
    </section>
  )
}

const ARTICLES = [
  { id: 'onyx-mogul-102', date: '12 de outubro', read: '5 min', title: 'Como funciona a propriedade de NFTs', text: 'Entenda o que você compra, o que fica registrado na rede e como provar a procedência.' },
  { id: 'emerald-ape-042', date: '05 de outubro', read: '4 min', title: '10 artistas digitais para acompanhar', text: 'Criadores que estão redefinindo retratos, música e arte generativa.' },
  { id: 'sage-nomad-069', date: '28 de setembro', read: '6 min', title: 'Raridade, atributos e procedência', text: 'Como ler atributos, edições e histórico antes de colecionar.' },
  { id: 'golden-beat-207', date: '20 de setembro', read: '3 min', title: 'Como proteger sua carteira', text: 'Boas práticas de segurança para carteiras quentes e frias.' },
]

export function Journal() {
  return (
    <section id="diario" aria-labelledby="journal-title" className="container-kurio mt-16 scroll-mt-20">
      <div className="mb-6 text-center">
        <h2 id="journal-title" className="text-base font-bold md:text-lg">
          Diário da Cunhagem
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ARTICLES.map((a) => (
          <li key={a.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-lg bg-surface">
              <NftImage image={{ base: `/images/nfts/${a.id}`, alt: '' }} sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 90vw" decorative className="aspect-[16/10] rounded-none" />
              <div className="flex flex-1 flex-col gap-1.5 p-3">
                <p className="text-[0.625rem] text-subtle-foreground">
                  <time>{a.date}</time> · Leitura de {a.read}
                </p>
                <h3 className="text-xs leading-snug font-bold">{a.title}</h3>
                <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">{a.text}</p>
                <p className="mt-auto pt-1 text-[0.6875rem] font-semibold text-primary">Em breve no Diário</p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}
