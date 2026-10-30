import { expect, test, USERS } from './fixtures'

test.describe('Conta e sessão', () => {
  test('cadastro: validação, conflito de e-mail e criação de conta', async ({ kurio, page }) => {
    await kurio.goto('/cadastro')
    const dialog = page.getByRole('dialog')
    await dialog.getByTestId('register-submit').click()
    // erros associados aos campos
    const name = dialog.getByRole('textbox', { name: /Nome de exibição/ })
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toBeFocused()
    const describedBy = await name.getAttribute('aria-describedby')
    expect(describedBy).toContain('reg-name-error')
    await expect(dialog.locator('#reg-name-error')).toHaveText(/Informe ao menos 2 caracteres/)

    await name.fill('Diego Teste')
    await dialog.getByRole('textbox', { name: /E-mail/ }).fill(USERS.ana.email)
    await dialog.getByLabel('Senha', { exact: false }).first().fill('fraca')
    await dialog.getByLabel('Confirmar senha').fill('fraca')
    await dialog.getByTestId('register-submit').click()
    await expect(dialog.locator('#reg-password-error')).toContainText('8 caracteres')

    await dialog.getByLabel('Senha', { exact: false }).first().fill('Segura@2026')
    await dialog.getByLabel('Confirmar senha').fill('Segura@2026')
    await dialog.getByTestId('register-submit').click()
    // conflito retornado pela API
    await expect(dialog.locator('#reg-email-error')).toHaveText(/já está cadastrado/)
    await expect(dialog.getByRole('textbox', { name: /E-mail/ })).toBeFocused()

    await dialog.getByRole('textbox', { name: /E-mail/ }).fill('diego@kurio.dev')
    await dialog.getByTestId('register-submit').click()
    await expect(page).toHaveURL('/')
    await kurio.goto('/perfil')
    await expect(page.getByRole('textbox', { name: /Nome de exibição/ })).toHaveValue('Diego Teste')
  })

  test('login: credenciais inválidas e retorno ao fluxo anterior', async ({ kurio, page }) => {
    await kurio.goto('/perfil/carteiras')
    await expect(page).toHaveURL(/\/entrar\?redirect=/)
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(USERS.ana.email)
    await dialog.getByLabel('Senha').first().fill('senha-errada')
    await dialog.getByTestId('login-submit').click()
    await expect(dialog.getByTestId('auth-error')).toHaveText('E-mail ou senha incorretos.')
    await dialog.getByLabel('Senha').first().fill(USERS.ana.password)
    await dialog.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/perfil\/carteiras$/)
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('sessão sobrevive ao refresh', async ({ kurio, page }) => {
    await kurio.login(USERS.ana, '/perfil')
    await page.reload()
    await kurio.ready()
    await expect(page).toHaveURL(/\/perfil$/)
    await expect(page.getByRole('textbox', { name: /E-mail/ })).toHaveValue(USERS.ana.email)
  })

  test('expiração durante a navegação redireciona e preserva o retorno', async ({ kurio, page }) => {
    await kurio.login(USERS.ana, '/favoritos')
    await expect(page.getByTestId('favorites-grid')).toBeVisible()
    await kurio.control('session.expire')
    await page.getByRole('navigation', { name: 'Seções da conta' }).getByRole('link', { name: 'Pedidos' }).click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpedidos&reason=expired/)
    await expect(page.getByTestId('session-expired-alert')).toBeVisible()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(USERS.ana.email)
    await dialog.getByLabel('Senha').first().fill(USERS.ana.password)
    await dialog.getByTestId('login-submit').click()
    await expect(page).toHaveURL(/\/pedidos$/)
    await expect(page.getByTestId('orders-list')).toContainText('KUR-1000')
  })

  test('expiração natural pelo relógio (tempo controlado)', async ({ kurio, page }) => {
    await page.clock.install({ time: new Date('2026-10-29T12:00:00-03:00') })
    await kurio.login(USERS.ana, '/perfil')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    // sessão de 30 minutos: avança 31 minutos
    await page.clock.fastForward('31:00')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fperfil&reason=expired/, { timeout: 10_000 })
  })

  test('logout limpa dados privados e troca de usuário isola os dados', async ({ kurio, page }) => {
    await kurio.login(USERS.ana, '/favoritos')
    await expect(page.getByTestId('favorites-grid')).toContainText('Emerald Ape #042')
    await expect(page.getByTestId('header-cart')).toHaveAttribute('aria-label', /3 itens/)
    // ID de um pedido da Ana para checar isolamento depois
    await page.getByRole('navigation', { name: 'Seções da conta' }).getByRole('link', { name: 'Pedidos' }).click()
    await page.getByTestId('orders-list').getByRole('link', { name: /KUR-1000/ }).click()
    const anaOrderUrl = page.url()

    await kurio.goto('/perfil')
    await page.getByTestId('logout-button').click()
    await expect(page).toHaveURL('/')
    // cache privado removido
    const privateKeys = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('kurio:checkout:')))
    expect(privateKeys).toEqual([])
    await expect(page.getByTestId('header-cart')).toHaveAttribute('aria-label', 'Carrinho vazio')

    await kurio.login(USERS.bruno, '/favoritos')
    await expect(page.getByTestId('favorites-grid')).toContainText('Golden Signal #198')
    await expect(page.getByTestId('favorites-grid')).not.toContainText('Emerald Ape #042')
    // pedido de outro usuário: acesso negado pela API
    await page.goto(anaOrderUrl)
    await expect(page.getByTestId('order-forbidden')).toBeVisible()
    await expect(page.getByTestId('order-forbidden')).toContainText('Você não tem permissão')
  })
})
