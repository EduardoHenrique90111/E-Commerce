import { expect, test, USERS } from './fixtures'
import { acceptAndConfirm, openReview } from './checkout-helpers'

test.describe('Compra completa', () => {
  test('do catálogo ao recibo confirmado, com snapshot imutável do pedido', async ({ kurio, page }) => {
    // 1. catálogo → detalhe
    await kurio.goto('/?q=ivory')
    await kurio.catalogCards().filter({ hasText: 'Ivory Baron #088' }).getByRole('link', { name: 'Ivory Baron #088' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Ivory Baron #088' })).toBeVisible()
    // 2. compra (visitante) → carrinho
    await page.getByTestId('buy-button').click()
    await expect(page).toHaveURL(/\/carrinho$/)
    // 3. finalizar → login → pagamento
    await page.getByTestId('checkout-button').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(USERS.carla.email)
    await dialog.getByLabel('Senha').first().fill(USERS.carla.password)
    await dialog.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/pagamento$/)
    // Carla não tem carteira: cadastra a principal e volta ao pagamento
    await expect(page.getByTestId('no-wallets')).toBeVisible()
    await page.getByTestId('no-wallets').getByRole('link', { name: 'Cadastrar carteira' }).click()
    const form = page.getByTestId('wallet-form-primary')
    await form.getByRole('textbox', { name: /Nome da carteira/ }).fill('Carteira da Carla')
    await form.getByRole('textbox', { name: /Apelido/ }).fill('Principal')
    await form.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x1111222233334444555566667777888899990000')
    await form.getByTestId('wallet-save-primary').click()
    await expect(page.getByText('Carteira principal salva.').first()).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao pagamento' }).click()
    await expect(page).toHaveURL(/\/pagamento$/)

    // 4. dados do colecionador + carteira + rede
    await page.getByRole('textbox', { name: /Observação do colecionador/ }).fill('Presente de aniversário')
    await page.getByLabel('Rede de pagamento').selectOption('polygon')
    const review = await openReview(page)
    await expect(review.getByTestId('summary-subtotal')).toHaveText('1.79 ETH')
    await expect(review).toContainText('Polygon')
    const total = await review.getByTestId('summary-total').innerText()
    await acceptAndConfirm(page)

    // 5. pendente → confirmado (evento order.updated via Socket.IO)
    await expect(page).toHaveURL(/\/pedidos\/ord_kur/)
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText(total)
    await expect(page.getByTestId('receipt-tx')).toHaveText(/^0x[0-9a-f]{64}$/)
    await expect(page.getByRole('link', { name: /Ver no explorador/ })).toHaveAttribute('href', /explorer\.kurio\.example\/polygon\/tx\/0x/)
    await expect(page.getByTestId('receipt-item')).toHaveCount(1)
    await expect(page.getByTestId('header-cart')).toHaveAttribute('aria-label', 'Carrinho vazio')

    // 6. alterações posteriores no catálogo não mudam o recibo
    await kurio.control('nft.setPrice', 'ivory-baron-088', 'padrao', 9_990_000)
    await page.reload()
    await kurio.ready()
    await expect(page.getByTestId('receipt-total')).toHaveText(total)
    await expect(page.getByTestId('receipt-line-total')).toHaveText('1.79 ETH')
  })

  test.describe('liquidação manual', () => {
    test.use({ mockConfig: { scenario: 'payment-manual' } })
    test('após a confirmação remove do carrinho apenas o que foi comprado', async ({ kurio, page }) => {
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      const review = await openReview(page)
      await expect(review.getByRole('listitem')).toHaveCount(2)
      await acceptAndConfirm(page)
      await expect(page.getByTestId('order-pending')).toBeVisible()
      const orderUrl = page.url()

      // enquanto o pedido está pendente, a colecionadora adiciona outro item
      await kurio.goto('/nft/emerald-ape-042')
      await page.getByTestId('buy-button').click()
      await expect(kurio.cartLines()).toHaveCount(3)
      await expect(page.getByTestId('pending-order-banner')).toBeVisible()

      // confirmação no servidor simulado
      await kurio.control('orders.settleAllPending', 'confirmed')
      await expect(kurio.cartLines()).toHaveCount(1)
      await expect(kurio.cartLines().first()).toContainText('Emerald Ape #042')
      await page.goto(orderUrl)
      await expect(page.getByTestId('order-confirmed')).toBeVisible()
      await expect(page.getByTestId('receipt-item')).toHaveCount(2)
    })
  })
})
