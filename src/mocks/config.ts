/**
 * Configuração e cenários da camada de mocks.
 *
 * O cenário ativo pode vir de:
 *  1. query string `?scenario=<nome>` (aplicado e persistido; `&reset=1` restaura os dados) —
 *     lida por `takeMockUrlParams()` antes da criação do router,
 *  2. localStorage (`kurio:mock:config`), usado também pelos testes via `addInitScript`,
 *  3. padrão (`default`).
 */

export const SCENARIO_NAMES = [
  'default',
  'empty-catalog',
  'slow-network',
  'variable-latency',
  'out-of-order',
  'offline',
  'server-error',
  'session-short',
  'favorites-failure',
  'price-change',
  'sold-out',
  'order-timeout',
  'payment-declined',
  'payment-manual',
  'wallet-reject',
  'realtime-offline',
] as const
export type ScenarioName = (typeof SCENARIO_NAMES)[number]

export interface FailureRule {
  /** Método HTTP (omitido = qualquer). */
  method?: string
  /** Prefixo do caminho, ex.: `/api/nfts` ou `/api/favorites`. */
  path: string
  /** Restrições de query string (valor `null` = parâmetro ausente). */
  query?: Record<string, string | null>
  /** Status HTTP, `network` (conexão indisponível) ou `timeout` (sem resposta). */
  status: number | 'network' | 'timeout'
  /** Quantas vezes falhar antes de voltar ao normal (omitido = sempre). */
  times?: number
  code?: string
}

export interface MockConfig {
  scenario: ScenarioName
  /** Semente do gerador pseudoaleatório (latência variável, hashes). */
  seed: number
  latency: { mode: 'none' | 'fixed' | 'variable'; ms: number; min: number; max: number }
  /** Buscas mais curtas respondem mais devagar → respostas fora de ordem. */
  outOfOrderSearch: boolean
  offline: boolean
  failures: FailureRule[]
  sessionTtlMs: number
  emptyCatalog: boolean
  favoritesFail: boolean
  priceChangeOnOrder: boolean
  soldOutOnOrder: boolean
  /** A primeira criação de cada pedido responde depois do timeout do cliente. */
  orderTimeout: boolean
  orderResponseDelayMs: number
  payment: { outcome: 'confirmed' | 'rejected' | 'manual'; settleDelayMs: number }
  /** Quantas tentativas de conexão de carteira serão recusadas. */
  walletRejections: number
  realtimeAvailable: boolean
  /** Intervalo do heartbeat Engine.IO enviado pelo servidor simulado. */
  heartbeatMs: number
}

export const DEFAULT_CONFIG: MockConfig = {
  scenario: 'default',
  seed: 42,
  latency: { mode: 'variable', ms: 250, min: 120, max: 420 },
  outOfOrderSearch: false,
  offline: false,
  failures: [],
  sessionTtlMs: 30 * 60 * 1000,
  emptyCatalog: false,
  favoritesFail: false,
  priceChangeOnOrder: false,
  soldOutOnOrder: false,
  orderTimeout: false,
  orderResponseDelayMs: 9000,
  payment: { outcome: 'confirmed', settleDelayMs: 2500 },
  walletRejections: 0,
  realtimeAvailable: true,
  heartbeatMs: 20_000,
}

export interface ScenarioDefinition {
  label: string
  description: string
  config: Partial<MockConfig>
}

export const SCENARIOS: Record<ScenarioName, ScenarioDefinition> = {
  default: { label: 'Padrão', description: 'Tudo funciona, com latência realista e determinística.', config: {} },
  'empty-catalog': { label: 'Catálogo vazio', description: 'A listagem de NFTs retorna zero resultados.', config: { emptyCatalog: true } },
  'slow-network': {
    label: 'Rede lenta',
    description: 'Todas as respostas levam ~2,5 s (exibe skeletons).',
    config: { latency: { mode: 'fixed', ms: 2500, min: 2500, max: 2500 } },
  },
  'variable-latency': {
    label: 'Latência variável',
    description: 'Latência entre 100 ms e 2 s, sorteada com semente fixa.',
    config: { latency: { mode: 'variable', ms: 0, min: 100, max: 2000 } },
  },
  'out-of-order': {
    label: 'Respostas fora de ordem',
    description: 'Buscas mais curtas respondem por último; o cliente deve descartar respostas obsoletas.',
    config: { outOfOrderSearch: true },
  },
  offline: { label: 'Sem conexão', description: 'Toda requisição REST falha por indisponibilidade de rede.', config: { offline: true } },
  'server-error': {
    label: 'Erro 500 recuperável',
    description: 'A listagem do catálogo (GET /api/nfts) falha 3 vezes com HTTP 500 e depois volta a responder.',
    config: { failures: [{ method: 'GET', path: '/api/nfts', query: { pageSize: null }, status: 500, times: 3, code: 'INTERNAL' }] },
  },
  'session-short': {
    label: 'Sessão curta',
    description: 'Novas sessões expiram em 60 segundos.',
    config: { sessionTtlMs: 60_000 },
  },
  'favorites-failure': {
    label: 'Falha em favoritos',
    description: 'Incluir/remover favoritos retorna HTTP 503 (rollback otimista).',
    config: { favoritesFail: true },
  },
  'price-change': {
    label: 'Preço alterado na compra',
    description: 'Ao enviar o pedido, o preço de um item sobe 12% e o servidor exige nova confirmação.',
    config: { priceChangeOnOrder: true },
  },
  'sold-out': {
    label: 'Edição esgotada na compra',
    description: 'Ao enviar o pedido, a edição do primeiro item esgota.',
    config: { soldOutOnOrder: true },
  },
  'order-timeout': {
    label: 'Timeout na criação do pedido',
    description: 'O pedido é criado, mas a resposta chega depois do timeout; o reenvio idempotente recupera o mesmo pedido.',
    config: { orderTimeout: true },
  },
  'payment-declined': {
    label: 'Pagamento recusado',
    description: 'Pedidos são recusados pela carteira simulada.',
    config: { payment: { outcome: 'rejected', settleDelayMs: 2000 } },
  },
  'payment-manual': {
    label: 'Liquidação manual',
    description: 'Pedidos ficam pendentes até serem confirmados/recusados no painel.',
    config: { payment: { outcome: 'manual', settleDelayMs: 0 } },
  },
  'wallet-reject': {
    label: 'Carteira recusa conexão',
    description: 'A primeira tentativa de conexão da carteira é recusada.',
    config: { walletRejections: 1 },
  },
  'realtime-offline': {
    label: 'Tempo real indisponível',
    description: 'O servidor Socket.IO recusa conexões (o cliente tenta reconectar).',
    config: { realtimeAvailable: false },
  },
}

const CONFIG_KEY = 'kurio:mock:config'

export function configForScenario(name: ScenarioName, overrides: Partial<MockConfig> = {}): MockConfig {
  const preset = SCENARIOS[name]?.config ?? {}
  return {
    ...DEFAULT_CONFIG,
    ...preset,
    latency: { ...DEFAULT_CONFIG.latency, ...preset.latency, ...overrides.latency },
    payment: { ...DEFAULT_CONFIG.payment, ...preset.payment, ...overrides.payment },
    ...omit(overrides, ['latency', 'payment']),
    scenario: name,
  }
}

function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const copy = { ...obj }
  for (const k of keys) delete copy[k]
  return copy
}

function isScenario(value: unknown): value is ScenarioName {
  return typeof value === 'string' && (SCENARIO_NAMES as readonly string[]).includes(value)
}

let current: MockConfig = DEFAULT_CONFIG
const listeners = new Set<(c: MockConfig) => void>()

export function getConfig(): MockConfig {
  return current
}

export function setConfig(next: MockConfig): void {
  current = next
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next))
  } catch {
    /* armazenamento indisponível: mantém em memória */
  }
  for (const l of listeners) l(current)
}

export function updateConfig(patch: Partial<MockConfig>): MockConfig {
  setConfig({ ...current, ...patch })
  return current
}

export function onConfigChange(listener: (c: MockConfig) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Lê a configuração persistida e aplica `?scenario=` / `?reset=1` (já removidos da URL por
 * `takeMockUrlParams()` antes da criação do router).
 */
export function initConfig(params: { scenario: string | null; reset: boolean } = { scenario: null, reset: false }): {
  resetRequested: boolean
  scenarioFromUrl: boolean
} {
  let stored: Partial<MockConfig> | null
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    stored = raw ? (JSON.parse(raw) as Partial<MockConfig>) : null
  } catch {
    stored = null
  }
  const base = stored && isScenario(stored.scenario) ? configForScenario(stored.scenario, stored) : DEFAULT_CONFIG
  const scenarioFromUrl = isScenario(params.scenario)
  current = isScenario(params.scenario) ? configForScenario(params.scenario) : base
  setConfig(current)
  return { resetRequested: params.reset, scenarioFromUrl }
}
