# Auditoria Lighthouse

Páginas auditadas: **Início** (`/`) e **Detalhe do NFT** (`/nft/emerald-ape-042`), perfis **mobile** e
**desktop**, **3 medições** por página e perfil, cenário padrão dos mocks, build otimizado.
Resumo gerado: [`reports/summary.md`](reports/summary.md) (medianas, todas as medições, links para os
relatórios HTML/JSON) e [`reports/summary.json`](reports/summary.json).

## Resultados (medianas)

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS | FCP | SI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Início | mobile | **75** ⚠️ | 100 | 100 | 100 | 3,81 s | 457 ms | 0 | 2,17 s | 2,20 s |
| Detalhe | mobile | **73** ⚠️ | 100 | 100 | 100 | 3,78 s | 539 ms | 0 | 2,20 s | 2,52 s |
| Início | desktop | **100** | 100 | 100 | 100 | 0,80 s | 32 ms | 0 | 0,52 s | 0,74 s |
| Detalhe | desktop | **99** | 100 | 100 | 100 | 0,93 s | 49 ms | 0 | 0,56 s | 0,77 s |

Metas: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90. Todas as metas são
atingidas, exceto **Performance no perfil mobile** (75 e 73). As causas estão analisadas abaixo.

## Como reproduzir

```bash
npx playwright install chromium   # ou tenha o Google Chrome instalado
npm run lighthouse                # build + vite preview + 12 medições (≈10 min)
```

Configuração versionada:

| Arquivo | Conteúdo |
| --- | --- |
| [`config.mobile.mjs`](config.mobile.mjs) | Moto G Power 412×823 (DPR 1,75), throttling simulado: RTT 150 ms, 1,6 Mbps, CPU 4× |
| [`config.desktop.mjs`](config.desktop.mjs) | 1350×940 (DPR 1), throttling simulado: RTT 40 ms, 10 Mbps, CPU 1× |
| [`audit.config.mjs`](audit.config.mjs) | páginas, perfis, 3 medições, metas, tempo máximo e novas tentativas |
| [`../scripts/lighthouse.mjs`](../scripts/lighthouse.mjs) | execução, medianas, relatórios e registro do ambiente |

Cada medição roda em um processo Node e um perfil de Chrome novos (cache e `localStorage` vazios → cenário
padrão dos mocks, primeira visita). Opções: `--no-build`, `--url=<URL publicada>`, `--profiles=mobile`,
`--pages=inicio`, `--runs=N`, `--timeout=<ms>`, `--passive` (ver abaixo).

## Ambiente e condições desta medição

| Item | Valor |
| --- | --- |
| Data | 30/10/2026 |
| Lighthouse | 13.4.1 (motor do DevTools do Chromium 153, executado em Node via puppeteer-core); relatório HTML renderizado com o renderer oficial do repositório GoogleChrome/lighthouse |
| Navegador | Chromium 153.0.8010.12 (headless) |
| Node.js | 22.23.4 |
| Máquina | Linux x64, 2 vCPU Intel Xeon 2,1 GHz, 8 GB de RAM; BenchmarkIndex mediano ≈ 1 700 |
| Build | equivalente ao `vite build --mode production` (esbuild + Tailwind CSS 4: minificação, code splitting, `modulepreload`, mesmas variáveis `.env.production`) |
| Servidor | estático local com brotli/gzip pré-calculados (como uma hospedagem estática), HTTP/1.1 |
| Mocks | cenário `default` (latência simulada de 120–420 ms por requisição, semente fixa) |
| Coleta | `--passive` (`usePassiveGathering`): ver nota abaixo |

**Por que esse ambiente.** O ambiente em nuvem em que esta entrega foi construída não tem acesso ao registro
npm, então o pacote `lighthouse` não pôde ser instalado ali. As medições usaram o motor do Lighthouse 13.4
que acompanha o próprio Chromium e um build equivalente ao do Vite. No seu computador, `npm run lighthouse`
usa o pacote npm (`lighthouse@^13.4`) e o build real do Vite; os números podem variar alguns pontos
(o Rollup agrupa os módulos em menos arquivos, e o desempenho da CPU muda o TBT).

**Coleta passiva.** Nesse Chromium headless, o teste ativo de *back/forward cache* (o Lighthouse navega
para `chrome://terms` e volta) derrubava o navegador de forma intermitente (`SIGTRAP`). A opção `--passive`
desliga só essa navegação e o redimensionamento da captura de página inteira. A auditoria de bfcache tem
peso 0 e nenhuma pontuação é afetada. As configurações versionadas mantêm a coleta padrão.

## Análise do resultado mobile

### O que o perfil mobile simula

O Lighthouse **não** mede o celular de verdade: ele carrega a página sem limitação, registra o trace e
**simula** (modelo Lantern) como seria numa rede 4G lenta (1,6 Mbps, RTT 150 ms) com CPU 4× mais lenta.
Medido sem limitação, o carregamento é rápido:

| Métrica | Início observado | Início simulado | Detalhe observado | Detalhe simulado |
| --- | --- | --- | --- | --- |
| FCP | 0,53 s | 2,3 s | 0,51 s | 2,3 s |
| LCP | 0,94 s | 3,8 s | 1,01 s | 3,8 s |

### Causas

1. **LCP (3,8 s, nota 0,55) depende de dados.** No mobile, o elemento LCP é a imagem do primeiro card do
   catálogo (início) e a imagem principal do NFT (detalhe). As duas só existem depois de: baixar o JavaScript
   da aplicação, iniciar a camada de mocks, receber a resposta da API simulada e renderizar. Na simulação, só
   a transferência do JavaScript inicial — **270 KB comprimidos (891 KB descomprimidos) em 34 arquivos** —
   leva cerca de 1,3 s a 1,6 Mbps. A imagem em si já tem prioridade alta e carrega em ~40 ms.
2. **O JavaScript inicial é formado pela stack obrigatória mais um "servidor" rodando no navegador.**
   Aproximadamente, sem compressão: camada de simulação (MSW, interceptors, protocolo Socket.IO, handlers e
   fixtures) ≈ 210 KB, React DOM 179 KB, código da aplicação 139 KB, TanStack Router 86 KB, zod 58 KB,
   Radix/shadcn 58 KB, Axios 47 KB, TanStack Query 35 KB, tailwind-merge 26 KB e sonner 19 KB. A camada de
   mocks precisa estar no build publicado (requisito); com uma API real esse código não existiria.
3. **TBT (457–539 ms, nota 0,54–0,62).** O trabalho no thread principal soma 3,4 s simulados: montagem e
   *commit* do React (~1,0 s; o commit não pode ser fatiado), a camada MSW (~0,4–0,5 s: início do worker,
   tratamento das requisições no thread principal, carga das fixtures) e estilo/layout/GC (~0,8 s). Como a
   CPU é multiplicada por 4, tarefas de 60–80 ms reais viram tarefas longas de 250–320 ms.
4. **FCP (2,2 s, nota 0,76).** A aplicação é uma SPA sem renderização no servidor: o primeiro conteúdo
   depende do JavaScript. O CSS (11 KB) bloqueia a renderização por ~150 ms.
5. **Variação.** Com 2 vCPU compartilhadas, o TBT varia ±200 ms entre medições (de 405 a 892 ms no detalhe);
   por isso o resumo usa a mediana de 3 medições.

CLS é 0 em todas as medições e o Speed Index fica em 2,2–2,5 s (nota ≥ 0,98).

### O que foi otimizado (medido no mesmo ambiente)

| Mudança | Efeito |
| --- | --- |
| Handler inicial do MSW devolve à rede tudo que não é `/api/*` | o worker deixava de avaliar ~40 handlers (e ler `document.cookie`) por imagem e script: −100 ms de CPU real |
| Axios com adaptador `fetch` e `credentials: 'omit'` | a API usa token; sem cookies, o MSW não lê `document.cookie` |
| Interface montada antes do service worker (barreira `networkReady`) | shell e skeletons não esperam o MSW |
| `useDeferredValue` nas listas e montagem inicial como transição | renderização fatiada da grade, do detalhe e dos relacionados |
| Socket.IO e painel de simulação carregados com o navegador ocioso | tirados do caminho crítico |
| Filtros laterais montados só no desktop | remove o layout síncrono forçado pelo Slider no mobile |
| `Intl.NumberFormat` reutilizado | evita criar formatadores a cada card |
| Galeria do detalhe com largura definida no mobile e skeleton com as dimensões finais | CLS do detalhe de 0,315 para 0 |
| Primeira linha do catálogo com `fetchpriority="high"` e sem `lazy`; hero pré-carregado | imagem LCP sem atraso de descoberta |

Resultado no mobile: **início 62 → 75** (TBT 990 → 457 ms) e **detalhe 55 → 73** (CLS 0,315 → 0).

### O que fecharia a diferença (não feito, com os custos)

- **Pré-renderizar** o HTML de início e detalhe (SSG/SSR): FCP e LCP deixariam de depender do JavaScript.
  Exige uma etapa de renderização no servidor ou no build, fora do escopo de uma SPA com dados simulados no
  navegador.
- **Backend real** no lugar dos mocks no navegador: remove ~210 KB de JavaScript e o processamento das
  requisições no thread principal. Os mocks no build de demonstração são requisito da entrega.
- **Hospedagem com HTTP/2** (Vercel/Netlify/Cloudflare): baixar 34 arquivos é mais barato que no servidor
  local HTTP/1.1 usado aqui; vale medir a URL publicada com `npm run lighthouse -- --url=<URL>`.
- **Dependências mais leves** (validação de respostas, utilitário de classes): ganhos de poucos KB cada, com
  troca de bibliotecas da base.

Não foram feitas simplificações exclusivas para a auditoria: as páginas carregam as mesmas imagens, fontes,
mocks, tempo real e painel de simulação da demonstração, no cenário padrão (com a mesma latência simulada).
