import { expect, test, USERS } from './fixtures'

// PNG 1x1 válido (vermelho)
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64')

test.describe('Perfil do colecionador', () => {
  test('edição dos dados com validação local e da API, persistência após refresh', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.carla, '/perfil')
    const form = page.getByTestId('profile-form')
    const name = form.getByRole('textbox', { name: /Nome de exibição/ })
    const username = form.getByRole('textbox', { name: /Nome de usuário/ })

    // validação local
    await name.fill('C')
    await form.getByTestId('profile-save').click()
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toBeFocused()

    // erro de validação retornado pela API (nome reservado)
    await name.fill('Carla M. Mendes')
    await username.fill('admin')
    await form.getByTestId('profile-save').click()
    await expect(form.locator('#profile-username-error')).toHaveText(/reservado/)
    await expect(username).toBeFocused()

    // conflito retornado pela API (nome em uso)
    await username.fill('anacoleciona')
    await form.getByTestId('profile-save').click()
    await expect(form.locator('#profile-username-error')).toHaveText(/já está em uso/)

    await username.fill('carla.mendes')
    await form.getByRole('textbox', { name: /Bio/ }).fill('Colecionadora de fotografia digital.')
    await form.getByTestId('profile-save').click()
    await expect(page.getByText('Perfil atualizado').first()).toBeVisible()

    await page.reload()
    await kurio.ready()
    await expect(name).toHaveValue('Carla M. Mendes')
    await expect(username).toHaveValue('carla.mendes')
    await expect(form.getByRole('textbox', { name: /Bio/ })).toHaveValue('Colecionadora de fotografia digital.')
  })

  test('avatar: tipo inválido é recusado; imagem válida é salva e persiste', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.carla, '/perfil')
    const input = page.getByTestId('avatar-input')
    await input.setInputFiles({ name: 'documento.txt', mimeType: 'text/plain', buffer: Buffer.from('não é imagem') })
    await expect(page.getByTestId('avatar-error')).toHaveText(/Formato não suportado/)

    await input.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 10) })
    await expect(page.getByTestId('avatar-error')).toHaveText(/no máximo 2 MB/)

    await input.setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX })
    const preview = page.getByTestId('avatar-preview').getByRole('img', { name: /Foto de perfil de Carla Mendes/ })
    await expect(preview).toHaveAttribute('src', /^data:image\/webp;base64,/)
    await page.reload()
    await kurio.ready()
    await expect(preview).toHaveAttribute('src', /^data:image\/webp;base64,/)
  })

  test('alteração de senha: senha atual incorreta, confirmação divergente e sucesso', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.carla, '/perfil')
    const form = page.getByTestId('password-form')
    // campos de senha não têm papel "textbox"; os rótulos são verificados pelo label associado
    const current = form.getByLabel('Senha atual', { exact: false }).and(form.locator('input'))
    const next = form.locator('#pw-new')
    const confirm = form.locator('#pw-confirm')
    await expect(next).toHaveAccessibleName(/Nova senha/)

    await current.fill('errada')
    await next.fill('NovaSenha@1')
    await confirm.fill('NovaSenha@2')
    await form.getByTestId('password-save').click()
    await expect(form.locator('#pw-confirm-error')).toContainText('As senhas não conferem.')

    await confirm.fill('NovaSenha@1')
    await form.getByTestId('password-save').click()
    await expect(form.locator('#pw-current-error')).toContainText('Senha atual incorreta.')

    await current.fill(USERS.carla.password)
    await form.getByTestId('password-save').click()
    await expect(page.getByText('Senha alterada').first()).toBeVisible()
    await expect(current).toHaveValue('')

    // a nova senha passa a valer (a antiga não)
    await page.getByTestId('logout-button').click()
    await kurio.goto('/entrar')
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('E-mail').fill(USERS.carla.email)
    await dialog.getByLabel('Senha').first().fill(USERS.carla.password)
    await dialog.getByTestId('login-submit').click()
    await expect(dialog.getByTestId('auth-error')).toBeVisible()
    await dialog.getByLabel('Senha').first().fill('NovaSenha@1')
    await dialog.getByTestId('login-submit').click()
    await expect(page).not.toHaveURL(/\/entrar/)
  })
})

test.describe('Carteiras', () => {
  test('cadastro da principal e da secundária com validação local e da API', async ({ kurio, page }) => {
    await kurio.loginViaApi(USERS.carla, '/perfil/carteiras')
    const primary = page.getByTestId('wallet-form-primary')
    await primary.getByTestId('wallet-save-primary').click()
    await expect(primary.getByRole('textbox', { name: /Nome da carteira/ })).toHaveAttribute('aria-invalid', 'true')

    await primary.getByRole('textbox', { name: /Nome da carteira/ }).fill('Coleção da Carla')
    await primary.getByRole('textbox', { name: /Apelido/ }).fill('Principal')
    await primary.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x123')
    await primary.getByTestId('wallet-save-primary').click()
    await expect(primary.locator('#primary-wallet-address-error')).toContainText('0x seguido de 40')

    // endereço já cadastrado por outra conta → conflito da API
    await primary.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0x5A3e9cB1d2F47a8E0b6C1D9e3F27a4B8c6D0E1F2')
    await primary.getByTestId('wallet-save-primary').click()
    await expect(primary.locator('#primary-wallet-address-error')).toContainText('já está cadastrado')

    await primary.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0xAbCdEf0123456789aBcDeF0123456789AbCdEf01')
    await primary.getByTestId('wallet-save-primary').click()
    await expect(page.getByText('Carteira principal salva.').first()).toBeVisible()

    // secundária: Phantom/Solana
    await page.getByTestId('add-secondary').click()
    const secondary = page.getByTestId('wallet-form-secondary')
    await secondary.getByRole('textbox', { name: /Nome da carteira/ }).fill('Reserva Solana')
    await secondary.getByRole('textbox', { name: /Apelido/ }).fill('Reserva')
    await secondary.getByRole('combobox', { name: /Tipo de carteira/ }).selectOption('phantom')
    await expect(secondary.getByRole('combobox', { name: /Rede/ })).toHaveValue('solana')
    await secondary.getByRole('textbox', { name: /Endereço da carteira/ }).fill('0xAbCdEf0123456789aBcDeF0123456789AbCdEf01')
    await secondary.getByTestId('wallet-save-secondary').click()
    await expect(secondary.locator('#secondary-wallet-address-error')).toContainText('Solana')
    await secondary.getByRole('textbox', { name: /Endereço da carteira/ }).fill('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
    await secondary.getByTestId('wallet-save-secondary').click()
    await expect(page.getByText('Carteira secundária salva.').first()).toBeVisible()

    // edição persiste após refresh
    await primary.getByRole('textbox', { name: /Apelido/ }).fill('Cofre')
    await primary.getByTestId('wallet-save-primary').click()
    await expect(page.getByText('Carteira principal salva.').first()).toBeVisible()
    await page.reload()
    await kurio.ready()
    await expect(page.getByTestId('wallet-form-primary').getByRole('textbox', { name: /Apelido/ })).toHaveValue('Cofre')
    await expect(page.getByTestId('wallet-form-secondary').getByRole('textbox', { name: /Endereço da carteira/ })).toHaveValue('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
  })
})
