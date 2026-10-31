import { expect, test } from './fixtures'

test.describe('Início — catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e restauração pelo histórico', async ({ kurio, page }) => {
    await kurio.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: /seja dono do futuro/i })).toBeVisible()
    await expect(kurio.catalogCards()).toHaveCount(12)
    await expect(page.getByTestId('results-count')).toHaveText('48 NFTs encontrados')

    // paginação
    await page.getByRole('navigation', { name: 'Paginação do catálogo' }).getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    const page2 = await kurio.catalogNames()

    // ordenação
    await page.getByLabel('Ordenar por:').selectOption('price-asc')
    await expect(page).toHaveURL(/sort=price-asc/)
    await expect(page).not.toHaveURL(/page=/)
    // a grade mantém os resultados anteriores visíveis até a nova página chegar: aguarda a ordem nova
    const shownPrices = async () =>
      (await kurio.catalogCards().locator('[aria-hidden="true"]', { hasText: 'ETH' }).allInnerTexts()).map((p) => Number(p.replace(' ETH', '')))
    await expect
      .poll(async () => {
        const values = await shownPrices()
        return values.length === 12 && values.every((v, i) => i === 0 || values[i - 1] <= v)
      })
      .toBe(true)

    // filtros combinados: coleção + rede
    const filters = await kurio.filters()
    await filters.getByRole('button', { name: /Música/ }).click()
    await expect(page).toHaveURL(/col=musica/)
    await filters.getByRole('button', { name: /Polygon/ }).click()
    await expect(page).toHaveURL(/net=polygon/)
    await kurio.closeFilters()
    await expect(page.getByTestId('results-count')).toContainText(/\d+ NFTs? encontrados?/)
    const filteredCount = await kurio.catalogCards().count()
    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThan(12)
    await expect(page.getByRole('button', { name: 'Remover filtro Música' })).toBeVisible()

    // busca textual combinada aos filtros
    await page.getByRole('searchbox', { name: /Buscar NFTs/ }).fill('golden')
    await expect(page).toHaveURL(/q=golden/)
    await expect(kurio.catalogCards().first()).toContainText('Golden')

    // histórico: voltar desfaz busca, filtros e ordenação na ordem inversa
    await page.goBack()
    await expect(page).not.toHaveURL(/q=golden/)
    await expect(page).toHaveURL(/net=polygon/)
    await page.goBack()
    await expect(page).not.toHaveURL(/net=polygon/)
    await expect(page).toHaveURL(/col=musica/)
    await page.goBack()
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(page).not.toHaveURL(/sort=/)
    expect(await kurio.catalogNames()).toEqual(page2)

    // avançar restaura o estado
    await page.goForward()
    await expect(page).toHaveURL(/sort=price-asc/)
  })

  test('acesso direto com filtros na URL e navegação para o NFT', async ({ kurio, page }) => {
    await kurio.goto('/?col=musica&sort=price-desc')
    await expect(page.getByRole('button', { name: 'Remover filtro Música' })).toBeVisible()
    const first = kurio.catalogCards().first()
    const name = (await first.locator('h3').innerText()).trim()
    await first.getByRole('link', { name }).click()
    await expect(page).toHaveURL(/\/nft\//)
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  })

  test('resultado vazio e limpeza dos filtros', async ({ kurio, page }) => {
    await kurio.goto('/?q=inexistente-xyz')
    await expect(page.getByTestId('catalog-empty')).toBeVisible()
    await expect(page.getByTestId('results-count')).toHaveText('0 NFTs encontrados')
    await page.getByTestId('catalog-empty').getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(kurio.catalogCards()).toHaveCount(12)
  })

  test.describe('cenário: catálogo vazio', () => {
    test.use({ mockConfig: { scenario: 'empty-catalog' } })
    test('exibe estado vazio vindo da API', async ({ kurio, page }) => {
      await kurio.goto('/')
      await expect(page.getByTestId('catalog-empty')).toBeVisible()
    })
  })

  test.describe('cenário: respostas fora de ordem', () => {
    test.use({ mockConfig: { scenario: 'out-of-order' } })
    test('descarta a resposta obsoleta de uma busca anterior', async ({ kurio, page }) => {
      await kurio.goto('/')
      await expect(kurio.catalogCards()).toHaveCount(12)
      const search = page.getByRole('searchbox', { name: /Buscar NFTs/ })
      // "go" responde em ~800 ms; "golden" responde em ~80 ms e chega antes
      await search.fill('go')
      await page.waitForTimeout(450)
      await search.fill('golden')
      await expect(page).toHaveURL(/q=golden/)
      await expect(kurio.catalogCards().first()).toContainText('Golden')
      // espera a resposta lenta de "go" chegar e verifica que ela não sobrescreveu a lista
      await page.waitForTimeout(1200)
      const names = await kurio.catalogNames()
      expect(names.length).toBeGreaterThan(0)
      for (const n of names) expect(n.toLowerCase()).toContain('golden')
    })
  })
})
