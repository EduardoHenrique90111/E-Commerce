import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { NftImage } from '@/components/nft/nft-image'
import { cn } from '@/lib/utils'

/** Slides estáticos do hero (o primeiro coincide com o preload do index.html → LCP rápido). */
const SLIDES = [
  { id: 'emerald-ape-042', name: 'Emerald Ape #042', alt: 'Retrato ilustrado de um macaco de óculos escuros e jaqueta college verde — Emerald Ape #042.' },
  { id: 'golden-beat-207', name: 'Golden Beat #207', alt: 'Retrato ilustrado de um orangotango com fones de ouvido verdes — Golden Beat #207.' },
  { id: 'onyx-mogul-102', name: 'Onyx Mogul #102', alt: 'Retrato ilustrado de um gorila de gola alta e blazer creme — Onyx Mogul #102.' },
]

export const HERO_SIZES = '(min-width: 1024px) 460px, (min-width: 768px) 40vw, 40vw'

export function Hero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  return (
    <section aria-labelledby="hero-title" className="container-kurio pt-6 md:pt-10">
      <div className="grid grid-cols-[1fr_40%] items-center gap-4 overflow-hidden rounded-xl bg-surface p-4 md:grid-cols-[1fr_40%] md:gap-10 md:bg-transparent md:p-0 lg:grid-cols-[1fr_460px]">
        <div className="flex min-w-0 flex-col items-start gap-3 md:gap-5">
          <p className="eyebrow text-[0.625rem] md:text-xs">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-base leading-tight font-extrabold tracking-tight text-foreground uppercase sm:text-xl md:text-3xl md:leading-[1.25] lg:text-[2.5rem]">
            Seja dono do futuro <br className="hidden sm:block" />
            da arte digital
          </h1>
          <p className="hidden max-w-md text-xs leading-relaxed text-muted-foreground sm:block md:text-sm">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, música, fotografia e colecionáveis
            verificados — com carteiras Ethereum, Polygon e Solana.
          </p>
          <Button asChild size="sm" className="uppercase md:h-10 md:px-5">
            <Link to="/" hash="catalogo">
              Explorar
            </Link>
          </Button>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Link to="/nft/$nftId" params={{ nftId: slide.id }} className="block w-full rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label={`Ver ${slide.name}`}>
            <NftImage image={{ base: `/images/nfts/${slide.id}`, alt: slide.alt }} sizes={HERO_SIZES} priority className="rounded-lg shadow-2xl shadow-black/40" />
          </Link>
          <div className="flex gap-1" role="group" aria-label="Destaques do hero">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Mostrar destaque ${i + 1} de ${SLIDES.length}: ${s.name}`}
                aria-pressed={i === index}
                className="flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className={cn('size-1.5 rounded-full bg-muted-foreground/50 transition-all', i === index && 'w-4 bg-primary')} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
