import { expect, test, USERS } from './fixtures'
import { openReview } from './checkout-helpers'

test.describe('Segurança', () => {
  test('cabeçalhos de segurança presentes no documento', async ({ page }) => {
    const response = await page.request.get('/')
    const headers = response.headers()
    const csp = headers['content-security-policy'] ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("worker-src 'self'")
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['cross-origin-opener-policy']).toBe('same-origin')
    expect(headers['permissions-policy']).toContain('camera=()')
    expect(headers['strict-transport-security']).toContain('max-age=')
  })

  test('a aplicação funciona sob a CSP, sem violações (mocks, tempo real e checkout)', async ({ kurio, page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cspViolations: string[] }
      w.__cspViolations = []
      document.addEventListener('securitypolicyviolation', (e) => {
        w.__cspViolations.push(`${e.violatedDirective} → ${e.blockedURI || 'inline'}`)
      })
    })
    await kurio.goto('/')
    await expect(kurio.catalogCards().first()).toBeVisible()
    await kurio.goto('/nft/emerald-ape-042')
    await expect(page.getByTestId('nft-detail')).toBeVisible()
    await kurio.loginViaApi(USERS.ana, '/pagamento')
    await kurio.waitRealtimeConnected()
    await openReview(page)
    const violations = await page.evaluate(() => (window as unknown as { __cspViolations: string[] }).__cspViolations)
    expect(violations).toEqual([])
  })

  test('login bloqueado temporariamente após 5 senhas erradas', async ({ kurio, page }) => {
    await kurio.goto('/entrar')
    const dialog = page.getByRole('dialog')
    const tryLogin = async (password: string) => {
      await dialog.getByLabel('E-mail').fill(USERS.bruno.email)
      await dialog.getByLabel('Senha').first().fill(password)
      await dialog.getByTestId('login-submit').click()
    }
    const error = dialog.getByTestId('auth-error')

    await tryLogin('errada-1')
    await expect(error).toHaveText('E-mail ou senha incorretos.')
    await tryLogin('errada-2')
    await tryLogin('errada-3')
    await expect(error).toContainText('Restam 2 tentativa(s)')
    await tryLogin('errada-4')
    await expect(error).toContainText('Restam 1 tentativa(s)')
    await tryLogin('errada-5')
    await expect(error).toContainText('Muitas tentativas de login')

    // durante o bloqueio, nem a senha correta é aceita
    await tryLogin(USERS.bruno.password)
    await expect(error).toContainText('Muitas tentativas de login')
    await expect(page).toHaveURL(/\/entrar/)

    // o bloqueio vale só para aquele e-mail
    await dialog.getByLabel('E-mail').fill(USERS.ana.email)
    await dialog.getByLabel('Senha').first().fill(USERS.ana.password)
    await dialog.getByTestId('login-submit').click()
    await expect(page).not.toHaveURL(/\/entrar/)
  })
})
