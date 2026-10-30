/**
 * Armazenamento do token de sessão.
 *
 * Ponto único de extensão para a camada de segurança: hoje o token opaco fica no localStorage
 * para sobreviver a refresh (requisito da demonstração). Com um backend real, troque esta
 * implementação por cookie HttpOnly + SameSite (o restante do app não muda).
 * Senhas nunca passam por aqui.
 */
import { readString, removeKey, writeString } from '@/lib/storage'

const TOKEN_KEY = 'kurio:session-token'
type Listener = (token: string | null, source: 'local' | 'external') => void
const listeners = new Set<Listener>()

let current: string | null = readString(TOKEN_KEY)

export const tokenStore = {
  get(): string | null {
    return current
  },
  set(token: string | null): void {
    current = token
    if (token) writeString(TOKEN_KEY, token)
    else removeKey(TOKEN_KEY)
    for (const l of listeners) l(token, 'local')
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

// Outra aba entrou/saiu: mantém as abas consistentes (troca de usuário limpa dados privados).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return
    current = event.newValue
    for (const l of listeners) l(current, 'external')
  })
}

const GUEST_CART_KEY = 'kurio:guest-cart'

export const guestCartStore = {
  get(): string | null {
    return readString(GUEST_CART_KEY)
  },
  set(id: string | null): void {
    if (id) writeString(GUEST_CART_KEY, id)
    else removeKey(GUEST_CART_KEY)
  },
}
