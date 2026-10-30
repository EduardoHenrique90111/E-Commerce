/**
 * Plano da auditoria (versionado): páginas, perfis, número de medições e metas.
 * Usado por `scripts/lighthouse.mjs`.
 */
export default {
  /** Medições por página e perfil; o resumo usa a mediana. */
  runs: 3,
  pages: [
    { id: 'inicio', name: 'Início', path: '/' },
    { id: 'detalhe', name: 'Detalhe do NFT', path: '/nft/emerald-ape-042' },
  ],
  profiles: ['mobile', 'desktop'],
  /** Porta do `vite preview` iniciado pelo script (quando nenhuma URL é informada). */
  previewPort: 4173,
  /** Metas do enunciado (pontuação 0–100). */
  targets: { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 },
  /** Tempo máximo de uma medição; acima disso o Chrome é encerrado e a medição repetida. */
  runTimeoutMs: 120_000,
  /** Novas tentativas por medição (falha, travamento ou tempo esgotado). */
  retries: 4,
}
