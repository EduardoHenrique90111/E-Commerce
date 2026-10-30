import type { NftImage as NftImageData } from '@/api/contracts'
import { imageSrc, imageSrcSet } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  image: NftImageData
  sizes: string
  className?: string
  priority?: boolean
  /** Texto alternativo vazio quando a imagem é decorativa no contexto (ex.: nome já ao lado). */
  decorative?: boolean
}

/** Imagem responsiva quadrada (srcset WebP 320/640/960) com dimensões reservadas para evitar CLS. */
export function NftImage({ image, sizes, className, priority, decorative }: Props) {
  return (
    <img
      src={imageSrc(image.base, 640)}
      srcSet={imageSrcSet(image.base)}
      sizes={sizes}
      alt={decorative ? '' : image.alt}
      width={640}
      height={640}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('aspect-square h-auto w-full rounded-md bg-surface-2 object-cover', className)}
    />
  )
}
