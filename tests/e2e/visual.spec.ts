import type { Page } from '@playwright/test'
import { expect, test, USERS } from './fixtures'

/** Garante um quadro estável: fontes, imagens (inclusive lazy) e tempo real conectado. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'))
    await document.fonts.ready
    await Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((r) => {
              img.addEventListener('load', r, { once: true })
              img.addEventListener('error', r, { once: true })
            }),
      ),
    )
  })
  await expect(page.getByTestId('realtime-status').first()).toHaveAttribute('data-status', 'connected')
  await page.waitForTimeout(300)
}

const shot = { fullPage: true, mask: [] as never[] }

test.describe('Regressão visual', () => {
  test('início', async ({ kurio, page }) => {
    await kurio.goto('/')
    await expect(kurio.catalogCards()).toHaveCount(12)
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', shot)
  })

  test('detalhe do NFT', async ({ kurio, page }) => {
    await kurio.goto('/nft/emerald-ape-042')
    await expect(page.getByTestId('nft-detail')).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', shot)
  })

  test('carrinho', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/carrinho')
    await expect(page.getByTestId('summary-total')).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', shot)
  })

  test('pagamento', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/pagamento')
    await expect(page.getByTestId('summary-total')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', shot)
  })
})
