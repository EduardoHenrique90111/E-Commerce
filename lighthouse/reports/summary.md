# Auditoria Lighthouse — resumo

Gerado por `scripts/lighthouse.mjs` em 2026-10-30T07:05:17.988Z. Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

## Medianas (1 medições por página e perfil)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS | FCP | SI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Detalhe do NFT (`/nft/emerald-ape-042`) | mobile | 64 ⚠️ | 100 ✅ | 100 ✅ | 100 ✅ | 3.78 s | 516 ms | 0.000 | 2.22 s | 12.92 s |
| Detalhe do NFT (`/nft/emerald-ape-042`) | desktop | 99 ✅ | 100 ✅ | 100 ✅ | 100 ✅ | 0.93 s | 41 ms | 0.000 | 0.53 s | 0.79 s |

## Todas as medições

| Página | Perfil | Medição | Perf | A11y | BP | SEO | LCP | TBT | CLS | Relatórios |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Detalhe do NFT | mobile | 1 (mediana) | 64 | 100 | 100 | 100 | 3.78 s | 516 ms | 0.000 | [HTML](mobile/detalhe-run1.report.html) · [JSON](mobile/detalhe-run1.report.json) |
| Detalhe do NFT | desktop | 1 (mediana) | 99 | 100 | 100 | 100 | 0.93 s | 41 ms | 0.000 | [HTML](desktop/detalhe-run1.report.html) · [JSON](desktop/detalhe-run1.report.json) |

## Ferramentas, ambiente e condições

- Lighthouse: 13.4.1 (pacote npm: 13.4.0); chrome-launcher 1.2.1
- Navegador: Chrome/153.0.8010.12
- Node.js v22.23.4; Linux 6.18.44-fc-v185 (x64); CPU Intel(R) Xeon(R) Processor @ 2.10GHz × 2; 8 GB de RAM; BenchmarkIndex mediano 2060
- Build: teste; servidor: URL externa; URL base http://localhost:4173
- Mocks: cenário padrão (armazenamento vazio a cada medição); cache: frio (perfil de navegador novo a cada medição)
- Throttling simulado (Lantern): mobile = 4G lento (RTT 150 ms, 1,6 Mbps) + CPU 4×; desktop = RTT 40 ms, 10 Mbps, CPU 1× — ver `lighthouse/config.*.mjs`
