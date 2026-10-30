import { expect, test } from './fixtures'

test.describe('Detalhe do NFT', () => {
  test('acesso direto: galeria, informações, edição e quantidade', async ({ kurio, page }) => {
    await kurio.goto('/nft/emerald-ape-042')
    await expect(page).toHaveTitle(/Emerald Ape #042/)
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    const detail = page.getByTestId('nft-detail')
    await expect(detail.getByTestId('nft-price')).toContainText('1.10 ETH')
    await expect(detail.getByText('KUR-042-PAD')).toBeVisible()

    // galeria
    const gallery = page.getByRole('group', { name: 'Galeria de imagens' })
    await gallery.getByRole('button', { name: 'Mostrar imagem 2 de 4' }).click()
    await expect(gallery.getByRole('button', { name: 'Mostrar imagem 2 de 4' })).toHaveAttribute('aria-pressed', 'true')
    await expect(detail.getByRole('img', { name: /Detalhe do rosto/ })).toBeVisible()

    // edição: Ouro muda o preço; edição esgotada fica desabilitada
    await page.getByRole('radio', { name: /^Ouro/ }).click()
    await expect(detail.getByTestId('nft-price')).toContainText('2.42 ETH')
    await expect(page.getByRole('radio', { name: /^Prova do artista/ })).toBeDisabled()

    // quantidade limitada à disponibilidade da edição Ouro (5)
    const plus = page.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' })
    for (let i = 0; i < 6; i++) if (await plus.isEnabled()) await plus.click()
    await expect(page.getByRole('group', { name: 'Emerald Ape #042' }).locator('output')).toHaveText('5')
    await expect(plus).toBeDisabled()
  })

  test('NFT inexistente mostra página não encontrada', async ({ kurio, page }) => {
    await kurio.goto('/nft/nao-existe-999')
    await expect(page.getByTestId('nft-not-found')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('rota inexistente e acesso direto a rotas privadas', async ({ kurio, page }) => {
    await kurio.goto('/rota/que/nao/existe')
    await expect(page.getByTestId('not-found')).toBeVisible()
    await kurio.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil%2Fcarteiras/)
  })

  test('comprar adiciona ao carrinho com a edição e a quantidade escolhidas', async ({ kurio, page }) => {
    await kurio.goto('/nft/golden-beat-207')
    await page.getByRole('button', { name: 'Aumentar quantidade de Golden Beat #207' }).click()
    await page.getByTestId('buy-button').click()
    await expect(page).toHaveURL(/\/carrinho$/)
    const line = kurio.cartLines().filter({ hasText: 'Golden Beat #207' })
    await expect(line).toHaveCount(1)
    await expect(line.locator('output')).toHaveText('2')
  })
})
