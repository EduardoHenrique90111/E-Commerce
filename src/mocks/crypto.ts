/**
 * Utilitários criptográficos do backend simulado.
 * Senhas nunca são armazenadas em claro: PBKDF2-SHA256 com sal aleatório (WebCrypto).
 */

export const PBKDF2_ITERATIONS = 100_000

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function randomHex(bytes = 16): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)))
}

export interface PasswordHash {
  algorithm: 'pbkdf2-sha256'
  iterations: number
  salt: string
  hash: string
}

async function derive(password: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256)
  return toHex(bits)
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomHex(16)
  return { algorithm: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS, salt, hash: await derive(password, salt, PBKDF2_ITERATIONS) }
}

/** Comparação em tempo constante. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const candidate = await derive(password, stored.salt, stored.iterations)
  return safeEqual(candidate, stored.hash)
}

/** Token opaco de sessão. */
export function newToken(): string {
  return `kur_${randomHex(24)}`
}

/** Hash curto e estável (FNV-1a) usado para comparar payloads idempotentes e gerar hashes de transação simulados. */
export function stableHash(input: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

/** Serialização determinística (chaves ordenadas). */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}
