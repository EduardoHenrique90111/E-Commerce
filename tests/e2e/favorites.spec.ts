import { expect, test, USERS } from './fixtures'

test.describe('Favoritos', () => {
  test('visitante é levado ao login e volta ao NFT', async ({ kurio, page }) => {
    await kurio.goto('/nft/sage-nomad-069')
    await page.getByTestId('nft-detail').getByRole('button', { name: 'Favoritar Sage Nomad #069' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fsage-nomad-069/)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(USERS.carla.email)
    await dialog.getByLabel('Senha').first().fill(USERS.carla.password)
    await dialog.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/nft\/sage-nomad-069$/)
  })

  test('inclusão e remoção otimistas persistem na API', async ({ kurio, page }) => {
    await kurio.login(USERS.carla, '/nft/sage-nomad-069')
    const button = page.getByTestId('nft-detail').getByRole('button', { name: 'Favoritar Sage Nomad #069' })
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    // otimista: muda imediatamente
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await kurio.ready()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await kurio.goto('/favoritos')
    const grid = page.getByTestId('favorites-grid')
    await expect(grid).toContainText('Sage Nomad #069')
    await grid.getByRole('button', { name: 'Favoritar Sage Nomad #069' }).click()
    await expect(page.getByTestId('favorites-empty')).toBeVisible()
    await page.reload()
    await kurio.ready()
    await expect(page.getByTestId('favorites-empty')).toBeVisible()
  })

  test.describe('cenário: falha na mutation', () => {
    test.use({ mockConfig: { scenario: 'favorites-failure' } })
    test('rollback do estado otimista, feedback acessível e recuperação', async ({ kurio, page }) => {
      await kurio.login(USERS.carla, '/nft/golden-beat-207')
      const fav = page.getByTestId('nft-detail').getByRole('button', { name: 'Favoritar Golden Beat #207' })
      await fav.click()
      // estado otimista aparece imediatamente...
      await expect(fav).toHaveAttribute('aria-pressed', 'true')
      // ...e é desfeito quando a API responde 503
      await expect(fav).toHaveAttribute('aria-pressed', 'false')
      await expect(page.getByText(/Não foi possível favoritar Golden Beat #207/)).toBeVisible()
      await expect(page.getByTestId('live-assertive')).toContainText('O estado anterior foi restaurado')

      // recuperação: a API volta ao normal e a nova tentativa funciona
      await kurio.setConfig({ favoritesFail: false })
      await fav.click()
      await expect(fav).toHaveAttribute('aria-pressed', 'true')
      await page.reload()
      await kurio.ready()
      await expect(fav).toHaveAttribute('aria-pressed', 'true')
    })
  })
})
