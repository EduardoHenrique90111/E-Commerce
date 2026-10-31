import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Cabeçalhos de segurança: fonte única em vercel.json (regra "/(.*)").
 * Aplicados também ao `vite preview`, que é o servidor usado pelos testes E2E e pela auditoria.
 * O servidor de desenvolvimento não os recebe: o Fast Refresh injeta scripts inline.
 */
interface VercelConfig {
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
}
const vercel = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, 'vercel.json'), 'utf8')) as VercelConfig
const securityHeaders = Object.fromEntries((vercel.headers?.find((rule) => rule.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true, headers: securityHeaders },
  build: {
    target: 'es2022',
    sourcemap: true,
    // MSW + Socket.IO stay out of the critical path: they are loaded in their own chunks.
    chunkSizeWarningLimit: 600,
  },
})
