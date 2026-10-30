#!/usr/bin/env node
/**
 * Auditoria Lighthouse reproduzível (início e detalhe do NFT, perfis mobile e desktop).
 *
 *   npm run lighthouse                     # build otimizado + vite preview + 3 medições por página/perfil
 *   npm run lighthouse -- --no-build       # reaproveita o dist/ existente
 *   npm run lighthouse -- --url=https://kurio.vercel.app   # audita uma URL publicada
 *   npm run lighthouse -- --profiles=mobile --pages=inicio --runs=1
 *   (com --url, use --build-label="..." e --server-label="..." para descrever o que foi auditado)
 *   --timeout=<ms> limita cada medição (padrão em lighthouse/audit.config.mjs)
 *   --passive      coleta passiva (sem o teste ativo de back/forward cache), se o navegador falhar nessa etapa
 *
 * Variáveis de ambiente:
 *   CHROME_PATH        executável do Chrome/Chromium (padrão: Chromium do Playwright, se instalado;
 *                      senão o Chrome encontrado pelo chrome-launcher)
 *   LH_CHROME_FLAGS    flags extras do Chrome, separadas por espaço (ex.: "--no-sandbox" em contêineres)
 *
 * Saída: lighthouse/reports/<perfil>/<página>-run<N>.report.{html,json} + summary.{json,md}
 * Cada medição usa um perfil de navegador novo (cache e armazenamento vazios → cenário padrão dos mocks).
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import plan from '../lighthouse/audit.config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const outDir = path.join(root, 'lighthouse', 'reports')

/* ------------------------------------------------------------------ */
/* argumentos                                                           */
/* ------------------------------------------------------------------ */
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const runs = Number(args.runs ?? plan.runs)
const profiles = String(args.profiles ?? plan.profiles.join(',')).split(',')
const pages = plan.pages.filter((p) => !args.pages || String(args.pages).split(',').includes(p.id))
const runTimeoutMs = Number(args.timeout ?? plan.runTimeoutMs)
const externalUrl = typeof args.url === 'string' ? args.url.replace(/\/$/, '') : process.env.LH_BASE_URL?.replace(/\/$/, '')

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const METRICS = {
  'first-contentful-paint': 'FCP',
  'largest-contentful-paint': 'LCP',
  'total-blocking-time': 'TBT',
  'cumulative-layout-shift': 'CLS',
  'speed-index': 'SI',
}

/* ------------------------------------------------------------------ */
/* utilitários                                                          */
/* ------------------------------------------------------------------ */
const log = (...m) => console.log('[lighthouse]', ...m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const median = (values) => {
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2
}
function pkgVersion(name) {
  try {
    return JSON.parse(fs.readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version
  } catch {
    try {
      // pacotes com "exports" que não expõem package.json
      let dir = path.dirname(require.resolve(name))
      while (dir !== path.dirname(dir)) {
        const f = path.join(dir, 'package.json')
        if (fs.existsSync(f)) {
          const j = JSON.parse(fs.readFileSync(f, 'utf8'))
          if (j.name === name) return j.version
        }
        dir = path.dirname(dir)
      }
    } catch {
      /* ignorado */
    }
    return 'desconhecida'
  }
}

function runNode(argv, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argv, { cwd: root, stdio: 'inherit' })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${label} terminou com código ${code}`))))
    child.on('error', reject)
  })
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* aguardando */
    }
    await sleep(250)
  }
  throw new Error(`O servidor não respondeu em ${url}`)
}

async function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  try {
    const { chromium } = await import('@playwright/test')
    const p = chromium.executablePath()
    if (p && fs.existsSync(p)) return p
  } catch {
    /* Playwright ausente: usa o Chrome instalado */
  }
  return undefined
}

function withTimeout(promise, ms, label) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label}: tempo esgotado (${ms} ms)`)), ms)
    }),
  ])
}

/* ------------------------------------------------------------------ */
/* servidor                                                             */
/* ------------------------------------------------------------------ */
let server = null
async function startServer() {
  if (externalUrl) {
    log(`auditando URL informada: ${externalUrl}`)
    return { baseUrl: externalUrl, kind: typeof args['server-label'] === 'string' ? args['server-label'] : 'URL externa' }
  }
  const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!args['no-build']) {
    log('gerando build otimizado (vite build --mode production)…')
    await runNode([viteBin, 'build', '--mode', 'production'], 'vite build')
  } else if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    throw new Error('dist/ não encontrado: rode sem --no-build ou execute "npm run build:demo" antes.')
  }
  const port = plan.previewPort
  server = spawn(process.execPath, [viteBin, 'preview', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' })
  const baseUrl = `http://localhost:${port}`
  await waitForHttp(`${baseUrl}/`)
  log(`servidor de preview em ${baseUrl}`)
  return { baseUrl, kind: `vite preview (build de produção, porta ${port})` }
}
function stopServer() {
  if (server && !server.killed) server.kill()
}
process.on('SIGINT', () => {
  stopServer()
  process.exit(130)
})

/* ------------------------------------------------------------------ */
/* medições                                                             */
/* ------------------------------------------------------------------ */
async function loadConfig(profile) {
  const file = path.join(root, 'lighthouse', `config.${profile}.mjs`)
  const config = (await import(pathToFileURL(file).href)).default
  // --passive: não navega para fora da página (teste ativo de back/forward cache e redimensionamento
  // da captura de página inteira). Não altera pontuações; útil se o navegador falhar nessa etapa.
  return args.passive ? { ...config, settings: { ...config.settings, usePassiveGathering: true } } : config
}

async function measure(url, config, executable) {
  const flags = ['--headless=new', ...(process.env.LH_CHROME_FLAGS?.split(' ').filter(Boolean) ?? [])]
  const chrome = await chromeLauncher.launch({ chromePath: executable, chromeFlags: flags })
  try {
    let browserVersion = null
    try {
      browserVersion = (await (await fetch(`http://127.0.0.1:${chrome.port}/json/version`)).json()).Browser ?? null
    } catch {
      /* opcional */
    }
    const result = await withTimeout(
      lighthouse(url, { port: chrome.port, output: ['html', 'json'], logLevel: process.env.LH_LOG_LEVEL ?? 'error' }, config),
      runTimeoutMs,
      url,
    )
    if (!result?.lhr) throw new Error('o Lighthouse não retornou resultado')
    if (result.lhr.runtimeError) throw new Error(`${result.lhr.runtimeError.code}: ${result.lhr.runtimeError.message}`)
    return { ...result, browserVersion }
  } finally {
    try {
      await chrome.kill()
    } catch {
      /* já encerrado */
    }
  }
}

/**
 * Modo filho: executa UMA medição e grava os relatórios + um resumo (result.json).
 * Cada medição roda em um processo próprio (estado do Lighthouse e do Chrome sempre limpos);
 * o tempo máximo é aplicado aqui, para que o Chrome seja encerrado mesmo se a medição travar.
 */
async function single() {
  const { profile, page: pageId, run, base: baseUrl } = args
  const page = plan.pages.find((p) => p.id === pageId)
  const config = await loadConfig(profile)
  const r = await measure(`${baseUrl}${page.path}`, config, await chromePath())
  const base = path.join(outDir, profile, `${page.id}-run${run}.report`)
  fs.mkdirSync(path.dirname(base), { recursive: true })
  fs.writeFileSync(`${base}.html`, r.report[0])
  fs.writeFileSync(`${base}.json`, r.report[1])
  const result = {
    scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((r.lhr.categories[c]?.score ?? 0) * 100)])),
    metrics: Object.fromEntries(Object.keys(METRICS).map((m) => [METRICS[m], r.lhr.audits[m]?.numericValue ?? null])),
    browserVersion: r.browserVersion,
    lighthouseVersion: r.lhr.lighthouseVersion,
    hostUserAgent: r.lhr.environment?.hostUserAgent ?? null,
    benchmarkIndex: r.lhr.environment?.benchmarkIndex ?? null,
    files: { html: path.relative(root, `${base}.html`), json: path.relative(root, `${base}.json`) },
  }
  fs.writeFileSync(`${base}.result.tmp.json`, JSON.stringify(result))
}

function runChild(profile, pageId, run, baseUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [fileURLToPath(import.meta.url), '--single', `--profile=${profile}`, `--page=${pageId}`, `--run=${run}`, `--base=${baseUrl}`, `--timeout=${runTimeoutMs}`, ...(args.passive ? ['--passive'] : [])],
      { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] },
    )
    // salvaguarda: o filho já aplica o próprio tempo máximo e encerra o Chrome
    const guard = setTimeout(() => child.kill(), runTimeoutMs + 60_000)
    child.on('exit', (code) => {
      clearTimeout(guard)
      const file = path.join(outDir, profile, `${pageId}-run${run}.report.result.tmp.json`)
      if (code === 0 && fs.existsSync(file)) {
        const result = JSON.parse(fs.readFileSync(file, 'utf8'))
        fs.rmSync(file, { force: true })
        resolve(result)
      } else reject(new Error(`medição terminou com código ${code}`))
    })
    child.on('error', reject)
  })
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  for (const profile of profiles) fs.rmSync(path.join(outDir, profile), { recursive: true, force: true })
  const { baseUrl, kind } = await startServer()
  const results = []
  let browserVersion = null
  let lighthouseVersion = null
  let hostUserAgent = null
  const benchmarkIndex = []

  try {
    for (const profile of profiles) {
      for (const page of pages) {
        for (let run = 1; run <= runs; run++) {
          let attempt = 0
          for (;;) {
            attempt++
            try {
              log(`${profile} · ${page.id} · medição ${run}/${runs}${attempt > 1 ? ` (tentativa ${attempt})` : ''}`)
              const r = await runChild(profile, page.id, run, baseUrl)
              browserVersion ??= r.browserVersion
              lighthouseVersion ??= r.lighthouseVersion
              hostUserAgent ??= r.hostUserAgent
              if (r.benchmarkIndex) benchmarkIndex.push(r.benchmarkIndex)
              results.push({ profile, page: page.id, run, scores: r.scores, metrics: r.metrics, files: r.files })
              const m = r.metrics
              log(`   → ${CATEGORIES.map((c) => `${c} ${r.scores[c]}`).join(' · ')} | LCP ${(m.LCP / 1000).toFixed(2)} s · TBT ${Math.round(m.TBT)} ms · CLS ${m.CLS.toFixed(3)}`)
              break
            } catch (error) {
              log(`   falhou: ${error.message}`)
              if (attempt > plan.retries) throw error
              await sleep(1000)
            }
          }
        }
      }
    }
  } finally {
    stopServer()
  }

  /* ---------------- resumo ---------------- */
  const groups = []
  for (const profile of profiles) {
    for (const page of pages) {
      const rs = results.filter((r) => r.profile === profile && r.page === page.id)
      if (!rs.length) continue
      const med = Object.fromEntries(CATEGORIES.map((c) => [c, median(rs.map((r) => r.scores[c]))]))
      const medMetrics = Object.fromEntries(Object.values(METRICS).map((m) => [m, median(rs.map((r) => r.metrics[m]))]))
      const representative = rs.find((r) => r.scores.performance === med.performance) ?? rs[0]
      groups.push({ profile, page: page.id, pageName: page.name, path: page.path, median: med, medianMetrics: medMetrics, representativeRun: representative.run, runs: rs })
    }
  }

  const environment = {
    date: new Date().toISOString(),
    lighthouse: lighthouseVersion ?? pkgVersion('lighthouse'),
    lighthousePackage: pkgVersion('lighthouse'),
    chromeLauncher: pkgVersion('chrome-launcher'),
    vite: pkgVersion('vite'),
    playwright: pkgVersion('@playwright/test'),
    browser: browserVersion,
    hostUserAgent,
    node: process.version,
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: `${os.cpus()[0]?.model ?? 'desconhecida'} × ${os.cpus().length}`,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    benchmarkIndex: benchmarkIndex.length ? Math.round(median(benchmarkIndex)) : null,
    server: kind,
    build: externalUrl
      ? typeof args['build-label'] === 'string'
        ? args['build-label']
        : 'build servido pela URL informada'
      : `Vite ${pkgVersion('vite')} (vite build --mode production)`,
    baseUrl,
    mocks: 'cenário padrão (armazenamento vazio a cada medição)',
    cache: 'frio (perfil de navegador novo a cada medição)',
    passiveGathering: Boolean(args.passive),
    runsPerPage: runs,
  }
  const summary = { targets: plan.targets, environment, groups }
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
  fs.writeFileSync(path.join(outDir, 'summary.md'), toMarkdown(summary))
  log(`resumo: ${path.relative(root, path.join(outDir, 'summary.md'))}`)
  for (const g of groups) {
    log(`${g.profile.padEnd(7)} ${g.page.padEnd(8)} mediana → ${CATEGORIES.map((c) => `${c} ${g.median[c]}`).join(' · ')}`)
  }
}

function toMarkdown({ targets, environment: env, groups }) {
  const ok = (cat, v) => (v >= targets[cat] ? `${v} ✅` : `${v} ⚠️`)
  const ms = (v) => (v == null ? '—' : `${Math.round(v)} ms`)
  const sec = (v) => (v == null ? '—' : `${(v / 1000).toFixed(2)} s`)
  const lines = []
  lines.push('# Auditoria Lighthouse — resumo', '')
  lines.push(`Gerado por \`scripts/lighthouse.mjs\` em ${env.date}. Metas: Performance ≥ ${targets.performance}, Accessibility ≥ ${targets.accessibility}, Best Practices ≥ ${targets['best-practices']}, SEO ≥ ${targets.seo}.`, '')
  lines.push(`## Medianas (${env.runsPerPage} medições por página e perfil)`, '')
  lines.push('| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS | FCP | SI |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const g of groups) {
    const m = g.medianMetrics
    lines.push(
      `| ${g.pageName} (\`${g.path}\`) | ${g.profile} | ${ok('performance', g.median.performance)} | ${ok('accessibility', g.median.accessibility)} | ${ok('best-practices', g.median['best-practices'])} | ${ok('seo', g.median.seo)} | ${sec(m.LCP)} | ${ms(m.TBT)} | ${m.CLS?.toFixed(3)} | ${sec(m.FCP)} | ${sec(m.SI)} |`,
    )
  }
  lines.push('', '## Todas as medições', '')
  lines.push('| Página | Perfil | Medição | Perf | A11y | BP | SEO | LCP | TBT | CLS | Relatórios |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
  for (const g of groups) {
    for (const r of g.runs) {
      const mark = r.run === g.representativeRun ? ' (mediana)' : ''
      const rel = (f) => f.replace(/^lighthouse[\\/]reports[\\/]/, '').replace(/\\/g, '/')
      lines.push(
        `| ${g.pageName} | ${g.profile} | ${r.run}${mark} | ${r.scores.performance} | ${r.scores.accessibility} | ${r.scores['best-practices']} | ${r.scores.seo} | ${sec(r.metrics.LCP)} | ${ms(r.metrics.TBT)} | ${r.metrics.CLS?.toFixed(3)} | [HTML](${rel(r.files.html)}) · [JSON](${rel(r.files.json)}) |`,
      )
    }
  }
  lines.push('', '## Ferramentas, ambiente e condições', '')
  lines.push(`- Lighthouse: ${env.lighthouse} (pacote npm: ${env.lighthousePackage}); chrome-launcher ${env.chromeLauncher}`)
  lines.push(`- Navegador: ${env.browser ?? env.hostUserAgent ?? 'desconhecido'}`)
  lines.push(`- Node.js ${env.node}; ${env.os}; CPU ${env.cpu}; ${env.memoryGb} GB de RAM; BenchmarkIndex mediano ${env.benchmarkIndex ?? '—'}`)
  lines.push(`- Build: ${env.build}; servidor: ${env.server}; URL base ${env.baseUrl}`)
  lines.push(`- Mocks: ${env.mocks}; cache: ${env.cache}`)
  if (env.passiveGathering) lines.push('- Coleta passiva (`--passive`, `usePassiveGathering`): sem o teste ativo de back/forward cache (auditoria de peso 0) nem o redimensionamento da captura de página inteira; as pontuações não são afetadas')
  lines.push('- Throttling simulado (Lantern): mobile = 4G lento (RTT 150 ms, 1,6 Mbps) + CPU 4×; desktop = RTT 40 ms, 10 Mbps, CPU 1× — ver `lighthouse/config.*.mjs`')
  lines.push('')
  return lines.join('\n')
}

const entry = args.single ? single : main
entry()
  .then(() => process.exit(0))
  .catch((error) => {
    stopServer()
    console.error('[lighthouse] erro:', error)
    process.exit(1)
  })
