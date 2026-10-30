import { useCallback, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePageMeta } from '@/lib/page-meta'
import { CatalogSection } from './catalog-section'
import { Hero } from './hero'
import { Journal, LaunchBanners } from './home-sections'
import type { CatalogSearch } from './search'

interface Props {
  search: CatalogSearch
  /** Quando usada como fundo do login/cadastro, a página não altera a URL. */
  interactive?: boolean
}

export function HomePage({ search, interactive = true }: Props) {
  const navigate = useNavigate()
  usePageMeta(
    interactive
      ? {
          title: search.q ? `“${search.q}” no catálogo — Kurio` : 'Kurio — Seja dono do futuro da arte digital',
          description:
            'Descubra, colecione e compre NFTs de arte digital, música, fotografia, arte 3D e colecionáveis verificados na Kurio, com carteiras Ethereum, Polygon e Solana.',
        }
      : null,
  )

  const onChange = useCallback(
    (patch: Partial<CatalogSearch>, options?: { replace?: boolean }) => {
      if (!interactive) return
      void navigate({
        to: '/',
        search: (prev: CatalogSearch) => {
          const next = { ...prev, ...patch, focus: undefined }
          return Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined)) as CatalogSearch
        },
        replace: options?.replace,
        resetScroll: false,
      })
    },
    [navigate, interactive],
  )

  // ?focus=1 (botão de busca do cabeçalho): foca o campo e limpa o parâmetro
  useEffect(() => {
    if (!interactive || !search.focus) return
    document.getElementById('catalog-search')?.focus()
    onChange({}, { replace: true })
  }, [interactive, search.focus, onChange])

  return (
    <>
      <Hero />
      <CatalogSection search={search} onChange={onChange} />
      <LaunchBanners />
      <Journal />
    </>
  )
}
