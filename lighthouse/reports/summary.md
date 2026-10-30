# Auditoria Lighthouse — resumo

Gerado por `scripts/lighthouse.mjs` em 2026-10-30T15:55:59.173Z. Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90.

## Medianas (3 medições por página e perfil)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS | FCP | SI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Início (`/`) | mobile | 75 ⚠️ | 100 ✅ | 100 ✅ | 100 ✅ | 3.81 s | 457 ms | 0.000 | 2.17 s | 2.20 s |
| Detalhe do NFT (`/nft/emerald-ape-042`) | mobile | 73 ⚠️ | 100 ✅ | 100 ✅ | 100 ✅ | 3.78 s | 539 ms | 0.000 | 2.20 s | 2.52 s |
| Início (`/`) | desktop | 100 ✅ | 100 ✅ | 100 ✅ | 100 ✅ | 0.80 s | 32 ms | 0.000 | 0.52 s | 0.74 s |
| Detalhe do NFT (`/nft/emerald-ape-042`) | desktop | 99 ✅ | 100 ✅ | 100 ✅ | 100 ✅ | 0.93 s | 49 ms | 0.000 | 0.56 s | 0.77 s |

## Todas as medições

| Página | Perfil | Medição | Perf | A11y | BP | SEO | LCP | TBT | CLS | Relatórios |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Início | mobile | 1 | 74 | 100 | 100 | 100 | 3.81 s | 499 ms | 0.000 | [HTML](mobile/inicio-run1.report.html) · [JSON](mobile/inicio-run1.report.json) |
| Início | mobile | 2 (mediana) | 75 | 100 | 100 | 100 | 3.81 s | 457 ms | 0.000 | [HTML](mobile/inicio-run2.report.html) · [JSON](mobile/inicio-run2.report.json) |
| Início | mobile | 3 | 79 | 100 | 100 | 100 | 3.73 s | 358 ms | 0.000 | [HTML](mobile/inicio-run3.report.html) · [JSON](mobile/inicio-run3.report.json) |
| Detalhe do NFT | mobile | 1 (mediana) | 73 | 100 | 100 | 100 | 3.78 s | 539 ms | 0.000 | [HTML](mobile/detalhe-run1.report.html) · [JSON](mobile/detalhe-run1.report.json) |
| Detalhe do NFT | mobile | 2 | 76 | 100 | 100 | 100 | 3.80 s | 405 ms | 0.000 | [HTML](mobile/detalhe-run2.report.html) · [JSON](mobile/detalhe-run2.report.json) |
| Detalhe do NFT | mobile | 3 | 66 | 100 | 100 | 100 | 3.73 s | 892 ms | 0.000 | [HTML](mobile/detalhe-run3.report.html) · [JSON](mobile/detalhe-run3.report.json) |
| Início | desktop | 1 | 99 | 100 | 100 | 100 | 0.80 s | 35 ms | 0.000 | [HTML](desktop/inicio-run1.report.html) · [JSON](desktop/inicio-run1.report.json) |
| Início | desktop | 2 (mediana) | 100 | 100 | 100 | 100 | 0.79 s | 32 ms | 0.000 | [HTML](desktop/inicio-run2.report.html) · [JSON](desktop/inicio-run2.report.json) |
| Início | desktop | 3 | 100 | 100 | 100 | 100 | 0.82 s | 14 ms | 0.000 | [HTML](desktop/inicio-run3.report.html) · [JSON](desktop/inicio-run3.report.json) |
| Detalhe do NFT | desktop | 1 (mediana) | 99 | 100 | 100 | 100 | 0.98 s | 12 ms | 0.000 | [HTML](desktop/detalhe-run1.report.html) · [JSON](desktop/detalhe-run1.report.json) |
| Detalhe do NFT | desktop | 2 | 99 | 100 | 100 | 100 | 0.90 s | 61 ms | 0.000 | [HTML](desktop/detalhe-run2.report.html) · [JSON](desktop/detalhe-run2.report.json) |
| Detalhe do NFT | desktop | 3 | 99 | 100 | 100 | 100 | 0.93 s | 49 ms | 0.000 | [HTML](desktop/detalhe-run3.report.html) · [JSON](desktop/detalhe-run3.report.json) |

## Ferramentas, ambiente e condições

- Lighthouse: 13.4.1 (pacote npm: 13.4.0); chrome-launcher 1.2.1
- Navegador: Chrome/153.0.8010.12
- Node.js v22.23.4; Linux 6.18.44-fc-v185 (x64); CPU Intel(R) Xeon(R) Processor @ 2.10GHz × 2; 8 GB de RAM; BenchmarkIndex mediano 1543
- Build: build de produção equivalente ao do Vite (esbuild + Tailwind CSS 4: minificação, code splitting e modulepreload; ambiente sem acesso ao npm); servidor: servidor estático local com compressão brotli/gzip pré-calculada (equivalente à hospedagem estática da Vercel), HTTP/1.1; URL base http://localhost:4173
- Mocks: cenário padrão (armazenamento vazio a cada medição); cache: frio (perfil de navegador novo a cada medição)
- Coleta passiva (`--passive`, `usePassiveGathering`): sem o teste ativo de back/forward cache (auditoria de peso 0) nem o redimensionamento da captura de página inteira; as pontuações não são afetadas
- Throttling simulado (Lantern): mobile = 4G lento (RTT 150 ms, 1,6 Mbps) + CPU 4×; desktop = RTT 40 ms, 10 Mbps, CPU 1× — ver `lighthouse/config.*.mjs`
