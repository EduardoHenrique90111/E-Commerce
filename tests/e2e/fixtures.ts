import { test as base, expect, type Locator, type Page } from '@playwright/test'
import type { MockConfig, ScenarioName } from '../../src/mocks/config'

export const USERS = {
  ana: { email: 'ana@kurio.dev', password: 'Kurio@123', id: 'usr_ana', name: 'Ana Colecionadora' },
  bruno: { email: 'bruno@kurio.dev', password: 'Kurio@456', id: 'usr_bruno', name: 'Bruno Ferreira' },
  carla: { email: 'carla@kurio.dev', password: 'Kurio@789', id: 'usr_carla', name: 'Carla Mendes' },
} as const

export type TestMockConfig = Partial<Omit<MockConfig, 'scenario'>> & { scenario?: ScenarioName }

/** Configuração determinística padrão dos testes: sem latência, liquidação rápida. */
const BASE_CONFIG: TestMockConfig = {
  scenario: 'default',
  seed: 42,
  latency: { mode: 'none', ms: 0, min: 0, max: 0 },
}
/** Liquidação rápida para o cenário padrão (os demais cenários mantêm o próprio comportamento de pagamento). */
const DEFAULT_PAYMENT = { outcome: 'confirmed' as const, settleDelayMs: 700 }

type ControlPath = string

export class Kurio {
  constructor(
    readonly page: Page,
    readonly isMobile: boolean,
  ) {}

  /** Navega e aguarda a camada de mocks e a aplicação estarem prontas. */
  async goto(path: string) {
    await this.page.goto(path)
    await this.ready()
  }

  async ready() {
    await this.page.waitForFunction(() => document.documentElement.dataset.mocks === 'ready' && !!document.getElementById('conteudo'))
  }

  /** Chama a API de controle do backend simulado (window.__KURIO_MOCK__), ex.: 'nft.bumpPrice'. */
  async control<T = unknown>(path: ControlPath, ...args: unknown[]): Promise<T> {
    await this.page.waitForFunction(() => !!window.__KURIO_MOCK__)
    return this.page.evaluate(
      ([p, a]) => {
        const parts = (p as string).split('.')
        let target: unknown = window.__KURIO_MOCK__
        let owner: unknown = null
        for (const part of parts) {
          owner = target
          target = (target as Record<string, unknown>)[part]
        }
        return (target as (...x: unknown[]) => unknown).apply(owner, a as unknown[])
      },
      [path, args] as const,
    ) as Promise<T>
  }

  async setConfig(patch: TestMockConfig) {
    await this.control('setConfig', patch)
  }

  /** Login pela interface (formulário real + API simulada). */
  async login(user: { email: string; password: string }, redirect?: string) {
    await this.goto(redirect ? `/entrar?redirect=${encodeURIComponent(redirect)}` : '/entrar')
    const dialog = this.page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(user.email)
    await dialog.getByLabel('Senha', { exact: false }).first().fill(user.password)
    await dialog.getByTestId('login-submit').click()
    await expect(this.page).not.toHaveURL(/\/entrar/)
  }

  /** Login direto na API simulada (preparação de testes que não exercitam o formulário). */
  async loginViaApi(user: { email: string; password: string }, then = '/') {
    await this.goto('/')
    await this.page.evaluate(async (u) => {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) })
      if (!res.ok) throw new Error(`login falhou: ${res.status}`)
      const body = (await res.json()) as { token: string }
      localStorage.setItem('kurio:session-token', body.token)
    }, user)
    await this.goto(then)
  }

  /** Linhas do carrinho (tabela no desktop, cartões no mobile). */
  cartLines(): Locator {
    return this.page.getByTestId(this.isMobile ? 'cart-line-mobile' : 'cart-line')
  }

  /** Abre os filtros (drawer no mobile; barra lateral no desktop) e devolve o contêiner. */
  async filters(): Promise<Locator> {
    if (this.isMobile) {
      await this.page.getByTestId('open-filters').click()
      const sheet = this.page.getByRole('dialog', { name: 'Filtros' })
      await expect(sheet).toBeVisible()
      return sheet
    }
    return this.page.locator('#catalogo')
  }

  async closeFilters() {
    if (this.isMobile) await this.page.getByRole('dialog', { name: 'Filtros' }).getByRole('button', { name: /^Ver \d+ resultados$/ }).click()
  }

  /** Cartões de NFT visíveis no catálogo. */
  catalogCards(): Locator {
    return this.page.getByTestId('catalog-grid').getByTestId('nft-card')
  }

  async catalogNames(): Promise<string[]> {
    return this.catalogCards().locator('h3').allInnerTexts()
  }

  /** Nenhum elemento ultrapassa a largura da janela (exceto dentro de áreas com rolagem própria). */
  async expectNoHorizontalOverflow() {
    const offenders = await this.page.evaluate(() => {
      const vw = document.documentElement.clientWidth
      const out: string[] = []
      for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const cs = getComputedStyle(el)
        if (cs.opacity === '0' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"], .sr-only')) continue
        if (r.right <= vw + 1 && r.left >= -1) continue
        // ignora conteúdo dentro de contêineres com rolagem horizontal intencional ou recortados
        let p = el.parentElement
        let scrolled = false
        while (p && p !== document.body) {
          const s = getComputedStyle(p)
          if (['auto', 'scroll', 'hidden', 'clip'].includes(s.overflowX)) {
            scrolled = true
            break
          }
          p = p.parentElement
        }
        if (scrolled) continue
        if (getComputedStyle(el).position === 'fixed') continue
        out.push(`${el.tagName.toLowerCase()}.${el.className.toString().slice(0, 60)} → ${Math.round(r.right)}px`)
      }
      return out.slice(0, 5)
    })
    expect(offenders, 'elementos fora da área visível horizontal').toEqual([])
  }

  /** Quantidade de eventos de tempo real efetivamente aplicados pelo cliente. */
  async realtimeApplied(): Promise<number> {
    return this.page.evaluate(() => Number(document.documentElement.dataset.realtimeApplied ?? 0))
  }

  async waitRealtimeConnected() {
    await expect(this.page.getByTestId('realtime-status').first()).toHaveAttribute('data-status', 'connected')
  }
}

export const test = base.extend<{ mockConfig: TestMockConfig; kurio: Kurio }>({
  mockConfig: [{}, { option: true }],
  kurio: async ({ page, mockConfig, isMobile }, use) => {
    const scenario = mockConfig.scenario ?? 'default'
    const config: TestMockConfig = { ...BASE_CONFIG, ...mockConfig, latency: { ...BASE_CONFIG.latency!, ...mockConfig.latency } }
    if (scenario === 'default' || mockConfig.payment) config.payment = { ...DEFAULT_PAYMENT, ...mockConfig.payment }
    await page.addInitScript((cfg) => {
      // aplica a configuração apenas no primeiro carregamento da aba (refresh preserva o estado do teste)
      if (sessionStorage.getItem('kurio:test-init')) return
      sessionStorage.setItem('kurio:test-init', '1')
      localStorage.setItem('kurio:mock:config', JSON.stringify(cfg))
      localStorage.setItem('kurio:mock:devtools', 'off')
    }, config)
    await use(new Kurio(page, isMobile))
  },
})

export { expect }

declare global {
  interface Window {
    __KURIO_MOCK__?: import('../../src/mocks/control').KurioMockControl
  }
}
