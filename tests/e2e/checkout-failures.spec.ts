import { expect, test, USERS } from './fixtures'
import { acceptAndConfirm, openReview, orderCount } from './checkout-helpers'

test.describe('Pagamento — falhas e recuperação', () => {
  test.describe('pagamento recusado', () => {
    test.use({ mockConfig: { scenario: 'payment-declined', payment: { outcome: 'rejected', settleDelayMs: 500 } } })
    test('exibe a recusa e preserva os itens no carrinho', async ({ kurio, page }) => {
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      await openReview(page)
      await acceptAndConfirm(page)
      await expect(page.getByTestId('order-rejected')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('order-rejected')).toContainText('recusou a assinatura')
      await expect(page.getByTestId('order-confirmed')).toHaveCount(0)
      await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
      await expect(kurio.cartLines()).toHaveCount(2)
    })
  })

  test('cliques repetidos criam um único pedido', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/pagamento')
    const before = await orderCount(kurio, USERS.ana.id)
    const review = await openReview(page)
    await review.getByRole('checkbox', { name: /Revisei os itens/ }).check()
    const posts: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/orders')) posts.push(r.headers()['idempotency-key'] ?? '')
    })
    // três cliques síncronos no mesmo quadro (antes de a interface desabilitar o botão)
    await review.getByTestId('confirm-order').evaluate((el: HTMLButtonElement) => {
      el.click()
      el.click()
      el.click()
    })
    await expect(page).toHaveURL(/\/pedidos\/ord_kur/)
    await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
    expect(await orderCount(kurio, USERS.ana.id)).toBe(before + 1)
    expect(posts.length).toBe(1)
  })

  test.describe('timeout após a criação do pedido', () => {
    test.use({ mockConfig: { scenario: 'order-timeout', payment: { outcome: 'confirmed', settleDelayMs: 500 } } })
    test('reenvia com a mesma chave e recupera o mesmo pedido', async ({ kurio, page }) => {
      test.setTimeout(60_000)
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      const before = await orderCount(kurio, USERS.ana.id)
      const keys: string[] = []
      page.on('request', (r) => {
        if (r.method() === 'POST' && r.url().endsWith('/api/orders')) keys.push(r.headers()['idempotency-key'] ?? '')
      })
      await openReview(page)
      await acceptAndConfirm(page)
      await expect(page.getByTestId('live-polite')).toContainText(/recuperado sem duplicidade/, { timeout: 15_000 })
      await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 15_000 })
      expect(keys.length).toBeGreaterThanOrEqual(2)
      expect(new Set(keys).size).toBe(1)
      expect(await orderCount(kurio, USERS.ana.id)).toBe(before + 1)
    })
  })

  test('chave de idempotência: mesmo conteúdo recupera o pedido; conteúdo diferente gera conflito', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/')
    const result = await page.evaluate(async () => {
      const token = localStorage.getItem('kurio:session-token')!
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      const wallets = await (await fetch('/api/wallets', { headers })).json()
      const walletId = wallets.items[0].id as string
      await fetch(`/api/wallets/${walletId}/connection`, { method: 'POST', headers, body: JSON.stringify({ network: 'ethereum' }) })
      const quote = await (await fetch('/api/quotes', { method: 'POST', headers, body: JSON.stringify({ network: 'ethereum' }) })).json()
      const payload = { quoteId: quote.quoteId, walletId, network: 'ethereum', collector: { name: 'Ana', email: 'ana@kurio.dev', note: '' }, acceptTerms: true }
      const key = 'test-key-0123456789abcdef'
      const post = (body: unknown) => fetch('/api/orders', { method: 'POST', headers: { ...headers, 'Idempotency-Key': key }, body: JSON.stringify(body) })
      const first = await post(payload)
      const firstBody = await first.json()
      const replay = await post(payload)
      const replayBody = await replay.json()
      const conflict = await post({ ...payload, collector: { ...payload.collector, note: 'outro conteúdo' } })
      const conflictBody = await conflict.json()
      return {
        first: [first.status, firstBody.id],
        replay: [replay.status, replayBody.id, replay.headers.get('Idempotent-Replayed')],
        conflict: [conflict.status, conflictBody.error.code],
      }
    })
    expect(result.first[0]).toBe(201)
    expect(result.replay).toEqual([200, result.first[1], 'true'])
    expect(result.conflict).toEqual([409, 'IDEMPOTENCY_CONFLICT'])
  })

  test.describe('carteira recusa a conexão', () => {
    test.use({ mockConfig: { scenario: 'wallet-reject' } })
    test('mostra a recusa e permite nova tentativa', async ({ kurio, page }) => {
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      await page.getByTestId('connect-wallet').click()
      await expect(page.getByTestId('wallet-error')).toContainText('recusada')
      await expect(page.getByTestId('wallet-status')).toContainText('Carteira não conectada')
      await page.getByTestId('connect-wallet').click()
      await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
    })
  })

  test('carteira desconectada antes do envio é tratada sem criar pedido', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/pagamento')
    const before = await orderCount(kurio, USERS.ana.id)
    await openReview(page)
    await kurio.control('wallet.disconnect', USERS.ana.id)
    await acceptAndConfirm(page)
    await expect(page.getByTestId('submit-error')).toContainText('Conecte a carteira')
    expect(await orderCount(kurio, USERS.ana.id)).toBe(before)
  })

  test('sessão expirada no checkout preserva o contexto para retomada', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/pagamento')
    await page.getByRole('textbox', { name: /Observação do colecionador/ }).fill('Entregar na carteira principal')
    await page.getByTestId('connect-wallet').click()
    await expect(page.getByTestId('wallet-status')).toContainText('Conectada')
    await kurio.control('session.expire')
    await page.getByTestId('review-button').click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento&reason=expired/)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(USERS.ana.email)
    await dialog.getByLabel('Senha').first().fill(USERS.ana.password)
    await dialog.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/pagamento$/)
    await expect(page.getByRole('textbox', { name: /Observação do colecionador/ })).toHaveValue('Entregar na carteira principal')
  })

  test.describe('preço alterado no envio', () => {
    test.use({ mockConfig: { scenario: 'price-change' } })
    test('o servidor rejeita a cotação e exige nova confirmação', async ({ kurio, page }) => {
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      const before = await orderCount(kurio, USERS.ana.id)
      const review = await openReview(page)
      const oldTotal = await review.getByTestId('summary-total').innerText()
      await acceptAndConfirm(page)
      await expect(review.getByTestId('quote-changed')).toContainText('Os valores mudaram')
      await expect(review.getByTestId('summary-total')).not.toHaveText(oldTotal)
      await expect(review.getByRole('checkbox', { name: /Revisei os itens/ })).not.toBeChecked()
      await expect(review.getByTestId('confirm-order')).toBeDisabled()
      expect(await orderCount(kurio, USERS.ana.id)).toBe(before)
      await acceptAndConfirm(page)
      await expect(page.getByTestId('order-confirmed')).toBeVisible({ timeout: 10_000 })
      expect(await orderCount(kurio, USERS.ana.id)).toBe(before + 1)
    })
  })

  test.describe('edição esgotada no envio', () => {
    test.use({ mockConfig: { scenario: 'sold-out' } })
    test('bloqueia a confirmação e informa a indisponibilidade', async ({ kurio, page }) => {
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      const before = await orderCount(kurio, USERS.ana.id)
      const review = await openReview(page)
      await acceptAndConfirm(page)
      await expect(review.getByRole('alert').filter({ hasText: 'esgotou' }).first()).toBeVisible()
      await expect(review.getByTestId('confirm-order')).toBeDisabled()
      expect(await orderCount(kurio, USERS.ana.id)).toBe(before)
    })
  })
})
