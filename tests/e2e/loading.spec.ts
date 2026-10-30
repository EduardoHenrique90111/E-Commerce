import { expect, test, USERS } from './fixtures'

test.describe('Carregamento, falhas e recuperação', () => {
  test.describe('rede lenta', () => {
    test.use({ mockConfig: { scenario: 'slow-network', latency: { mode: 'fixed', ms: 1500, min: 1500, max: 1500 } } })
    test('skeletons com shimmer no catálogo, detalhe e resumo do carrinho, sem deslocar o layout', async ({ kurio, page }) => {
      await kurio.goto('/')
      const skeletons = page.getByTestId('nft-card-skeleton')
      await expect(skeletons.first()).toBeVisible()
      expect(await skeletons.count()).toBe(12)
      const anim = await skeletons.first().locator('.skeleton').first().evaluate((el) => getComputedStyle(el).animationName)
      expect(anim).toBe('shimmer')
      // dimensões reservadas: o cartão final ocupa o mesmo espaço do skeleton
      const box = await skeletons.first().boundingBox()
      await expect(kurio.catalogCards().first()).toBeVisible({ timeout: 10_000 })
      const cardBox = await kurio.catalogCards().first().boundingBox()
      expect(Math.abs((cardBox?.width ?? 0) - (box?.width ?? 0))).toBeLessThan(2)

      await kurio.goto('/nft/emerald-ape-042')
      await expect(page.getByTestId('nft-detail-skeleton')).toBeVisible()
      await expect(page.getByTestId('nft-detail')).toBeVisible({ timeout: 10_000 })

      await kurio.loginViaApi(USERS.ana, '/carrinho')
      await expect(page.getByTestId('cart-skeleton')).toBeVisible()
      await expect(page.getByTestId('summary-skeleton').first()).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Resumo do carrinho' })).toBeVisible({ timeout: 10_000 })
    })

    test('respeita prefers-reduced-motion', async ({ kurio, page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await kurio.goto('/')
      const skeleton = page.getByTestId('nft-card-skeleton').first().locator('.skeleton').first()
      await expect(skeleton).toBeVisible()
      expect(await skeleton.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
    })
  })

  test.describe('erro 500 transitório', () => {
    test.use({ mockConfig: { scenario: 'server-error' } })
    test('mostra erro após os retries automáticos e recupera com nova tentativa', async ({ kurio, page }) => {
      await kurio.goto('/')
      const error = page.getByTestId('catalog-error')
      await expect(error).toBeVisible({ timeout: 10_000 })
      await expect(error).toContainText('Falha temporária no servidor')
      await error.getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(kurio.catalogCards()).toHaveCount(12)
    })
  })

  test.describe('sem conexão', () => {
    test.use({ mockConfig: { scenario: 'offline' } })
    test('informa a indisponibilidade e recupera quando a conexão volta', async ({ kurio, page }) => {
      await kurio.goto('/')
      await expect(page.getByTestId('catalog-error')).toContainText('Sem conexão com o servidor', { timeout: 10_000 })
      await kurio.setConfig({ offline: false })
      await page.getByTestId('catalog-error').getByRole('button', { name: 'Tentar novamente' }).click()
      await expect(kurio.catalogCards()).toHaveCount(12)
    })
  })

  test.describe('latência variável', () => {
    test.use({ mockConfig: { scenario: 'variable-latency', latency: { mode: 'variable', ms: 0, min: 100, max: 900 } } })
    test('atualização em segundo plano mantém os dados anteriores visíveis', async ({ kurio, page }) => {
      await kurio.goto('/')
      await expect(kurio.catalogCards()).toHaveCount(12)
      await page.getByRole('navigation', { name: 'Paginação do catálogo' }).getByRole('link', { name: 'Página 2' }).click()
      // os cartões da página anterior continuam na tela enquanto a nova página carrega
      await expect(kurio.catalogCards()).toHaveCount(12)
      await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    })
  })

  test.describe('tempo real indisponível', () => {
    test.use({ mockConfig: { scenario: 'realtime-offline' } })
    test('a interface continua funcionando e indica a reconexão', async ({ kurio, page }) => {
      await kurio.loginViaApi(USERS.ana, '/carrinho')
      await expect(page.getByTestId('realtime-status').first()).not.toHaveAttribute('data-status', 'connected')
      await expect(kurio.cartLines()).toHaveCount(2)
      await kurio.control('realtime.setAvailable', true)
      await kurio.waitRealtimeConnected()
    })
  })
})
