// Gera as imagens substitutas (WebP) a partir de src/mocks/fixtures/catalog.json.
// Uso: npm run assets:generate   (requer a dependência de desenvolvimento "sharp")
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { portraitSvg } from './art/portrait.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/mocks/fixtures/catalog.json'), 'utf8'))
const outNfts = path.join(root, 'public/images/nfts')
const outAvatars = path.join(root, 'public/images/avatars')
const outImages = path.join(root, 'public/images')
fs.mkdirSync(outNfts, { recursive: true })
fs.mkdirSync(outAvatars, { recursive: true })

const SIZES = [320, 640, 960]

async function renderSquare(svg, size, file, quality = 78) {
  await sharp(Buffer.from(svg), { density: Math.max(72, (size / 400) * 72) })
    .resize(size, size)
    .webp({ quality, effort: 5 })
    .toFile(file)
}

let count = 0
for (const nft of catalog) {
  const svg = portraitSvg(nft.art, { label: nft.name })
  for (const size of SIZES) {
    await renderSquare(svg, size, path.join(outNfts, `${nft.id}-${size}.webp`))
    count++
  }
}

// Avatares dos usuários de demonstração
const avatars = {
  'ana': { species: 'golden', bg: 'peach', outfit: 'tee', outfitColor: 'navy', headwear: 'none', eyes: 'open', mouth: 'smile', accessory: 'earring' },
  'bruno': { species: 'gorilla', bg: 'sky', outfit: 'hoodie', outfitColor: 'olive', headwear: 'beanie', eyes: 'open', mouth: 'smirk', accessory: 'none' },
  'carla': { species: 'orangutan', bg: 'lavender', outfit: 'blazer', outfitColor: 'black', headwear: 'none', eyes: 'round-glasses', mouth: 'smile', accessory: 'none' },
}
for (const [name, art] of Object.entries(avatars)) {
  const svg = portraitSvg(art, { label: name })
  for (const size of [96, 192]) await renderSquare(svg, size, path.join(outAvatars, `${name}-${size}.webp`), 80)
}

// Imagem Open Graph (1200x630)
const hero = catalog[0]
const heroPng = await sharp(Buffer.from(portraitSvg(hero.art))).resize(520, 520).png().toBuffer()
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#140e0b"/><text x="80" y="250" font-family="monospace" font-size="54" font-weight="700" fill="#f4ebe2">SEJA DONO DO FUTURO</text><text x="80" y="320" font-family="monospace" font-size="54" font-weight="700" fill="#f4ebe2">DA ARTE DIGITAL</text><text x="80" y="400" font-family="monospace" font-size="26" fill="#d98b4b">kurio · marketplace de NFTs</text></svg>`
await sharp(Buffer.from(ogSvg)).composite([{ input: heroPng, left: 620, top: 55 }]).webp({ quality: 80 }).toFile(path.join(outImages, 'og-kurio.webp'))

// Ícones
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#d98b4b"/><path d="M20 14h8v15l13-15h10L36 31l16 19H41L28 34v16h-8z" fill="#1a110c"/></svg>`
fs.writeFileSync(path.join(root, 'public/favicon.svg'), iconSvg + '\n')
await sharp(Buffer.from(iconSvg)).resize(180, 180).png().toFile(path.join(root, 'public/apple-touch-icon.png'))
await sharp(Buffer.from(iconSvg)).resize(192, 192).png().toFile(path.join(root, 'public/icon-192.png'))
await sharp(Buffer.from(iconSvg)).resize(512, 512).png().toFile(path.join(root, 'public/icon-512.png'))

console.log(`Gerados ${count} arquivos de NFT, ${Object.keys(avatars).length * 2} avatares, OG e ícones.`)
