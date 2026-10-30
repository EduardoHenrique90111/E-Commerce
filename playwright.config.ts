import { defineConfig, devices } from '@playwright/test'

/**
 * Testes E2E e de regressão visual (Chromium) executados contra o build de demonstração
 * (`vite build` + `vite preview`) com a camada de mocks MSW ativa.
 *
 *  - desktop-chromium / mobile-chromium: fluxos funcionais (todos os specs, exceto visual)
 *  - visual-desktop / visual-mobile: regressão visual (baselines em tests/e2e/__screenshots__)
 */
const baseURL = process.env.PW_BASE_URL ?? 'http://localhost:4173'

const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
const mobile = {
  ...devices['Desktop Chrome'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
}

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.015, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : process.env.CI ? 2 : undefined,
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  reporter: [['list'], ['html', { outputFolder: 'reports/playwright', open: 'never' }]],
  use: {
    baseURL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'desktop-chromium', use: desktop, testIgnore: /visual\.spec\.ts/ },
    { name: 'mobile-chromium', use: mobile, testIgnore: /visual\.spec\.ts/ },
    { name: 'visual-desktop', use: desktop, testMatch: /visual\.spec\.ts/ },
    { name: 'visual-mobile', use: mobile, testMatch: /visual\.spec\.ts/ },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: 'npm run build:demo && npm run preview',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
