import { expect, test, USERS } from './fixtures'
import { acceptAndConfirm, openReview, orderCount } from './checkout-helpers'

test.describe('Tempo real (Socket.IO via MSW)', () => {
  test('preço alterado durante a navegação atualiza carrinho e resumo', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/carrinho')
    await kurio.waitRealtimeConnected()
    const line = kurio.cartLines().filter({ hasText: 'Sage Nomad #069' })
    await expect(page.getByTestId('summary-subtotal')).toHaveText('3.46 ETH')
    const applied = await kurio.realtimeApplied()

    // mudança no servidor simulado → evento nft.updated pelo socket.io-client
    await kurio.control('nft.setPrice', 'sage-nomad-069', 'padrao', 1_600_000)
    await expect(page.getByTestId('live-polite')).toContainText('Preço de Sage Nomad #069 atualizado: 1.48 ETH → 1.60 ETH')
    await expect(line.getByTestId('price-changed')).toContainText('era 1.48 ETH')
    await expect(page.getByTestId('summary-subtotal')).toHaveText('3.58 ETH')
    await expect(page.getByTestId('summary-price-changed')).toBeVisible()
    expect(await kurio.realtimeApplied()).toBe(applied + 1)
  })

  test('edição esgotada em tempo real bloqueia a finalização', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/carrinho')
    await kurio.waitRealtimeConnected()
    await kurio.control('nft.setAvailable', 'golden-beat-207', 'padrao', 0)
    await expect(page.getByTestId('live-polite')).toContainText('Golden Beat #207 esgotou')
    await expect(kurio.cartLines().filter({ hasText: 'Golden Beat #207' }).getByTestId('sold-out')).toBeVisible()
    await expect(page.getByTestId('checkout-button')).toBeDisabled()
  })

  test('checkout impede a confirmação com cotação desatualizada', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/pagamento')
    await kurio.waitRealtimeConnected()
    const review = await openReview(page)
    const before = await review.getByTestId('summary-total').innerText()
    await review.getByRole('checkbox', { name: /Revisei os itens/ }).check()
    await expect(review.getByTestId('confirm-order')).toBeEnabled()

    await kurio.control('nft.bumpPrice', 'golden-beat-207', 10)
    await expect(review.getByTestId('quote-stale')).toContainText('Golden Beat #207: 0.99 ETH → 1.089 ETH')
    await expect(review.getByTestId('confirm-order')).toBeDisabled()
    await expect(review.getByRole('checkbox', { name: /Revisei os itens/ })).not.toBeChecked()

    await review.getByTestId('refresh-quote').click()
    await expect(review.getByTestId('quote-changed')).toContainText('Total:')
    await expect(review.getByTestId('summary-total')).not.toHaveText(before)
    const updated = await review.getByTestId('summary-total').innerText()
    await acceptAndConfirm(page)
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('receipt-total')).toHaveText(updated)
  })

  test('eventos duplicados ou antigos não regridem o estado nem reaplicam efeitos', async ({ kurio, page }) => {
    await kurio.goto('/nft/sage-nomad-069')
    await kurio.waitRealtimeConnected()
    const price = page.getByTestId('nft-detail').getByTestId('nft-price')
    await expect(price).toContainText('1.48 ETH')

    await kurio.control('nft.setPrice', 'sage-nomad-069', 'padrao', 1_700_000)
    await expect(price).toContainText('1.70 ETH')
    const applied = await kurio.realtimeApplied()

    // duplicata (mesmo id)
    expect(await kurio.control('realtime.replay')).toBe(true)
    // evento com versão antiga e preço menor
    expect(await kurio.control('realtime.emitStale', 'sage-nomad-069')).toBe(true)
    await page.waitForTimeout(500)
    await expect(price).toContainText('1.70 ETH')
    expect(await kurio.realtimeApplied()).toBe(applied)

    // um evento novo continua sendo aplicado
    await kurio.control('nft.setPrice', 'sage-nomad-069', 'padrao', 1_750_000)
    await expect(price).toContainText('1.75 ETH')
    expect(await kurio.realtimeApplied()).toBe(applied + 1)
  })

  test.describe('pedido pendente', () => {
    test.use({ mockConfig: { scenario: 'payment-manual' } })

    test('queda da conexão: reconecta, reconcilia via REST e não cria outra compra', async ({ kurio, page }) => {
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      const before = await orderCount(kurio, USERS.ana.id)
      await openReview(page)
      await acceptAndConfirm(page)
      await expect(page.getByTestId('order-pending')).toBeVisible()
      await kurio.waitRealtimeConnected()

      // servidor fica indisponível; o pedido é confirmado enquanto o cliente está desconectado
      await kurio.control('realtime.setAvailable', false)
      await expect(page.getByTestId('realtime-status').first()).not.toHaveAttribute('data-status', 'connected')
      await kurio.control('orders.settleAllPending', 'confirmed')
      await page.waitForTimeout(300)
      await expect(page.getByTestId('order-pending')).toBeVisible()

      // reconexão → reconciliação com a API REST
      await kurio.control('realtime.setAvailable', true)
      await kurio.waitRealtimeConnected()
      await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
      expect(await orderCount(kurio, USERS.ana.id)).toBe(before + 1)
    })

    test('refresh durante o pedido pendente recupera o estado; confirmação chega pelo socket', async ({ kurio, page }) => {
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      const before = await orderCount(kurio, USERS.ana.id)
      await openReview(page)
      await acceptAndConfirm(page)
      await expect(page.getByTestId('order-pending')).toBeVisible()
      const url = page.url()

      await page.reload()
      await kurio.ready()
      await expect(page).toHaveURL(url)
      await expect(page.getByTestId('order-pending')).toBeVisible()
      // o lembrete de pedido pendente acompanha a navegação
      await kurio.goto('/')
      await expect(page.getByTestId('pending-order-banner')).toBeVisible()
      await page.getByTestId('pending-order-banner').getByRole('link', { name: 'Acompanhar pedido' }).click()
      await kurio.waitRealtimeConnected()

      await kurio.control('orders.settleAllPending', 'confirmed')
      await expect(page.getByTestId('order-confirmed')).toBeVisible()
      await expect(page.getByTestId('live-polite')).toContainText(/Pedido KUR-\d+ confirmado/)
      expect(await orderCount(kurio, USERS.ana.id)).toBe(before + 1)

      // estado terminal: um evento antigo reenviado não volta o pedido para pendente
      await kurio.control('realtime.replay')
      await page.waitForTimeout(300)
      await expect(page.getByTestId('order-confirmed')).toBeVisible()
    })

    test('eventos de pedido de outro usuário não chegam à sessão atual', async ({ kurio, page }) => {
      // Ana cria um pedido pendente pela API
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      await openReview(page)
      await acceptAndConfirm(page)
      await expect(page.getByTestId('order-pending')).toBeVisible()
      // troca de usuário
      await kurio.goto('/perfil')
      await page.getByTestId('logout-button').click()
      await kurio.loginViaApi(USERS.bruno, '/pedidos')
      await kurio.waitRealtimeConnected()
      await expect(page.getByTestId('pending-order-banner')).toHaveCount(0)
      const applied = await kurio.realtimeApplied()
      const connections = await kurio.control<Array<{ userId: string | null }>>('realtime.connections')
      expect(connections.map((c) => c.userId)).toEqual([USERS.bruno.id])

      await kurio.control('orders.settleAllPending', 'confirmed')
      await page.waitForTimeout(500)
      // somente nft.updated (público) pode ter sido aplicado; nenhum aviso de pedido
      await expect(page.getByTestId('live-polite')).not.toContainText(/Pedido KUR-/)
      expect(await kurio.realtimeApplied()).toBeLessThanOrEqual(applied + 2)
      await expect(page.getByTestId('orders-list')).not.toContainText('KUR-1002')
    })
  })
})
