import { expect, test, USERS } from './fixtures'
import { openReview } from './checkout-helpers'

test.describe('Acessibilidade', () => {
  test('navegação por teclado com foco visível e link para pular conteúdo', async ({ kurio, page, isMobile }) => {
    test.skip(isMobile, 'teclado físico: validado no desktop')
    await kurio.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('#conteudo')).toBeFocused()

    // foco visível em elementos interativos
    await page.keyboard.press('Tab')
    const focused = page.locator(':focus')
    const style = await focused.evaluate((el) => {
      const s = getComputedStyle(el)
      return { outline: s.outlineStyle, shadow: s.boxShadow }
    })
    expect(style.outline !== 'none' || style.shadow !== 'none').toBe(true)

    // chega a um cartão do catálogo e abre o NFT com Enter
    const firstCardLink = kurio.catalogCards().first().getByRole('link')
    const name = await firstCardLink.innerText()
    await firstCardLink.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

    // edição: radiogroup operável por setas
    await page.getByRole('radio', { checked: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.locator(':focus')).toHaveAttribute('role', 'radio')
  })

  test('diálogo de revisão: foco preso, Esc fecha e devolve o foco ao gatilho', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.ana, '/pagamento')
    const dialog = await openReview(page)
    // foco dentro do diálogo
    await expect.poll(() => dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(page.getByTestId('review-button')).toBeFocused()
  })

  test('diálogo de login: foco inicial no primeiro campo e erros associados aos campos', async ({ kurio, page }) => {
    await kurio.goto('/entrar')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('E-mail')).toBeFocused()
    await dialog.getByTestId('login-submit').click()
    const email = dialog.getByLabel('E-mail')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAttribute('aria-describedby', /login-email-error/)
    await expect(dialog.locator('#login-email-error')).toContainText('Informe seu e-mail')
    await expect(email).toBeFocused()
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
  })

  test('drawer de filtros (mobile): foco preso e restaurado', async ({ kurio, page, isMobile }) => {
    test.skip(!isMobile, 'drawer só existe em telas pequenas')
    await kurio.goto('/')
    const trigger = page.getByTestId('open-filters')
    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab')
      expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('imagens relevantes têm texto alternativo; decorativas usam alt vazio', async ({ kurio, page }) => {
    await kurio.goto('/')
    await expect(kurio.catalogCards()).toHaveCount(12)
    const missing = await page.locator('img:not([alt])').count()
    expect(missing).toBe(0)
    const cardAlts = await kurio.catalogCards().locator('img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('alt')))
    for (const alt of cardAlts) expect(alt && alt.length > 10).toBe(true)
    await expect(page.locator('#hero-title')).toBeVisible()
    const heroAlt = await page.locator('section[aria-labelledby="hero-title"] img').getAttribute('alt')
    expect(heroAlt).toMatch(/Emerald Ape #042/)
  })

  for (const width of [320, 390, 768, 1440]) {
    test(`sem overflow horizontal em ${width}px (inclui reflow equivalente a zoom de 400%)`, async ({ kurio, page }) => {
      await page.setViewportSize({ width, height: 900 })
      for (const path of ['/', '/nft/emerald-ape-042', '/carrinho', '/entrar']) {
        await kurio.goto(path)
        await page.waitForTimeout(150)
        await kurio.expectNoHorizontalOverflow()
      }
      await kurio.loginViaApi(USERS.ana, '/pagamento')
      for (const path of ['/pagamento', '/perfil', '/perfil/carteiras', '/pedidos/ord_kur1000']) {
        await kurio.goto(path)
        await page.waitForTimeout(150)
        await kurio.expectNoHorizontalOverflow()
      }
    })
  }
})
