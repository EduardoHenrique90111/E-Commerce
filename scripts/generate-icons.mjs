// Gera src/components/icons.tsx a partir dos SVGs do Lucide (ISC) listados abaixo.
// Uso: node scripts/generate-icons.mjs <pasta-com-os-svgs-do-lucide>
// (os ícones gerados já estão versionados; o script serve para reproduzir/estender o conjunto)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = process.argv[2]
if (!src) {
  console.error('Informe a pasta icons/ de um checkout do lucide-icons/lucide.')
  process.exit(1)
}
const ICONS = {
  Search: 'search', ShoppingCart: 'shopping-cart', Heart: 'heart', User: 'user', Menu: 'menu', X: 'x',
  ChevronLeft: 'chevron-left', ChevronRight: 'chevron-right', ChevronDown: 'chevron-down', Minus: 'minus', Plus: 'plus',
  Trash: 'trash', Eye: 'eye', EyeOff: 'eye-off', Wallet: 'wallet', ShieldCheck: 'shield-check', Star: 'star', Check: 'check',
  TriangleAlert: 'triangle-alert', LoaderCircle: 'loader-circle', House: 'house', LogOut: 'log-out', LogIn: 'log-in', Settings: 'settings',
  Package: 'package', Bell: 'bell', Copy: 'copy', ExternalLink: 'external-link', RefreshCw: 'refresh-cw', Wifi: 'wifi', WifiOff: 'wifi-off',
  SlidersHorizontal: 'sliders-horizontal', Upload: 'upload', Camera: 'camera', Mail: 'mail', Lock: 'lock', Sparkles: 'sparkles', Info: 'info',
  CircleCheck: 'circle-check', CircleX: 'circle-x', Clock: 'clock', Tag: 'tag', TicketPercent: 'ticket-percent', Zap: 'zap', Users: 'users',
  Layers: 'layers', Receipt: 'receipt', ArrowLeft: 'arrow-left', ArrowRight: 'arrow-right', Funnel: 'funnel', Share: 'share-2', Gem: 'gem',
  BadgeCheck: 'badge-check', CircleUser: 'circle-user', Pencil: 'pencil', Plug: 'plug', Unplug: 'unplug', Image: 'image',
}
let out = `/* Gerado por scripts/generate-icons.mjs — ícones do Lucide (ISC License, https://lucide.dev). Não edite à mão. */\nimport type { SVGProps } from 'react'\n\nexport type IconProps = SVGProps<SVGSVGElement> & { size?: number }\n\nfunction base({ size = 20, strokeWidth = 2, ...props }: IconProps) {\n  return { xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false, ...props }\n}\n\n`
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
for (const [name, file] of Object.entries(ICONS)) {
  const svg = fs.readFileSync(path.join(src, `${file}.svg`), 'utf8')
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()
  const jsx = inner
    .replace(/\s+/g, ' ')
    .replace(/([a-z-]+)=/g, (m, attr) => `${camel(attr)}=`)
    .replace(/\/>\s*</g, '/>\n      <')
  out += `export function ${name}(props: IconProps) {\n  return (\n    <svg {...base(props)}>\n      ${jsx}\n    </svg>\n  )\n}\n\n`
}
fs.writeFileSync(path.join(root, 'src/components/icons.tsx'), out.trimEnd() + '\n')
console.log('icons.tsx:', Object.keys(ICONS).length, 'ícones')
