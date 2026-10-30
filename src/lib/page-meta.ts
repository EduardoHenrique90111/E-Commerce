import { useEffect } from 'react'

const DEFAULT_TITLE = 'Kurio — Seja dono do futuro da arte digital'

/** Atualiza <title> e meta description da rota (SEO e contexto para leitores de tela). */
export function usePageMeta(meta: { title: string; description?: string } | null) {
  const title = meta?.title
  const description = meta?.description
  useEffect(() => {
    if (!title) return
    document.title = title
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (!tag) {
        tag = document.createElement('meta')
        tag.name = 'description'
        document.head.appendChild(tag)
      }
      tag.content = description
    }
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [title, description])
}
