import { expect, test, USERS } from './fixtures'

test.describe('Carrinho', () => {
  test('quantidades, remoção, cupom e resumo de valores', async ({ kurio, page }) => {
    await kurio.goto('/nft/onyx-mogul-102')
    await page.getByTestId('buy-button').click()
    await expect(page).toHaveURL(/\/carrinho$/)
    const line = kurio.cartLines().filter({ hasText: 'Onyx Mogul #102' })
    await expect(page.getByTestId('summary-subtotal')).toHaveText('1.98 ETH')

    // quantidade (atualização otimista + confirmação do servidor)
    await line.getByRole('button', { name: 'Aumentar quantidade de Onyx Mogul #102' }).click()
    await expect(line.locator('output')).toHaveText('2')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('3.96 ETH')
    await line.getByRole('button', { name: 'Diminuir quantidade de Onyx Mogul #102' }).click()
    await expect(page.getByTestId('summary-subtotal')).toHaveText('1.98 ETH')

    // cupom inválido e expirado
    const coupon = page.getByRole('textbox', { name: 'Código promocional' })
    await coupon.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-error')).toHaveText('Cupom inválido.')
    await expect(coupon).toHaveAttribute('aria-invalid', 'true')
    await coupon.fill('EXPIRADO')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-error')).toHaveText('Este cupom expirou.')

    // cupom válido: 10% de desconto
    await coupon.fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('coupon-applied')).toContainText('KURIO10')
    await expect(page.getByTestId('summary-discount')).toHaveText('(-) 0.198 ETH')
    // total = 1.98 - 0.198 + 2,5% de 1.782 (0.04455) + rede 0.012
    await expect(page.getByTestId('summary-total')).toHaveText('1.83855 ETH')

    // remoção
    await line.getByRole('button', { name: 'Remover Onyx Mogul #102 do carrinho' }).click()
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('carrinho de visitante persiste após refresh e é unido ao da conta no login', async ({ kurio, page }) => {
    await kurio.goto('/nft/ivory-baron-088')
    await page.getByTestId('buy-button').click()
    await expect(kurio.cartLines()).toHaveCount(1)
    await page.reload()
    await kurio.ready()
    await expect(kurio.cartLines().filter({ hasText: 'Ivory Baron #088' })).toHaveCount(1)

    // finalizar exige login: volta para o pagamento com o carrinho unido
    await page.getByTestId('checkout-button').click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento/)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(USERS.ana.email)
    await dialog.getByLabel('Senha').first().fill(USERS.ana.password)
    await dialog.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/pagamento$/)
    await kurio.goto('/carrinho')
    // 2 itens da Ana + o item do visitante
    await expect(kurio.cartLines()).toHaveCount(3)
    await expect(kurio.cartLines().filter({ hasText: 'Ivory Baron #088' })).toHaveCount(1)
    await page.reload()
    await kurio.ready()
    await expect(kurio.cartLines()).toHaveCount(3)
  })

  test('não permite ultrapassar a disponibilidade (erro da API)', async ({ kurio, page }) => {
    // edição Ouro do Emerald Ape tem 5 disponíveis; reduz para 1 no servidor
    await kurio.goto('/nft/emerald-ape-042')
    await kurio.control('nft.setAvailable', 'emerald-ape-042', 'ouro', 1)
    await page.reload()
    await kurio.ready()
    await page.getByRole('radio', { name: /^Ouro/ }).click()
    await page.getByTestId('buy-button').click()
    await expect(page).toHaveURL(/\/carrinho$/)
    const line = kurio.cartLines().filter({ hasText: 'Emerald Ape #042' })
    await expect(line.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' })).toBeDisabled()
  })
})
