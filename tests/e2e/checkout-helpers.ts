import { expect, type Page } from '@playwright/test'
import type { Kurio } from './fixtures'

/** Conecta a carteira selecionada e abre a revisão do pedido. */
export async function openReview(page: Page) {
  const status = page.getByTestId('wallet-status')
  await expect(status).toBeVisible()
  if (!(await status.innerText()).includes('Conectada')) await page.getByTestId('connect-wallet').click()
  await expect(status).toContainText('Conectada')
  await page.getByTestId('review-button').click()
  const dialog = page.getByTestId('review-dialog')
  await expect(dialog.getByRole('heading', { name: 'Revise seu pedido' })).toBeVisible()
  await expect(dialog.getByTestId('summary-total')).toBeVisible()
  return dialog
}

export async function acceptAndConfirm(page: Page) {
  const dialog = page.getByTestId('review-dialog')
  await dialog.getByRole('checkbox', { name: /Revisei os itens/ }).check()
  await dialog.getByTestId('confirm-order').click()
}

export async function orderCount(kurio: Kurio, userId: string): Promise<number> {
  const orders = await kurio.control<Array<{ userId: string }>>('orders.list')
  return orders.filter((o) => o.userId === userId).length
}
