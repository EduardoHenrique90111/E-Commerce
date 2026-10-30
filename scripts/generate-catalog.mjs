// Gera src/mocks/fixtures/catalog.json de forma determinística (seed fixa).
// Uso: node scripts/generate-catalog.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let seed = 20261029
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min

const collections = ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'esportes', 'jogos', 'ilustracoes']
const networks = ['ethereum', 'polygon', 'solana']
const creators = [
  { name: 'Marina Vieira', handle: 'marinavieira' },
  { name: 'Studio Baobá', handle: 'studiobaoba' },
  { name: 'Teo Andrade', handle: 'teoandrade' },
  { name: 'Coletivo Jabuti', handle: 'coletivojabuti' },
  { name: 'Lia Okafor', handle: 'liaokafor' },
  { name: 'Rafa Nakamura', handle: 'rafanakamura' },
]
const species = ['chimp', 'gorilla', 'orangutan', 'silverback', 'golden']
const bgs = ['cream', 'mint', 'peach', 'lavender', 'sky', 'sand', 'sage']
const outfits = ['varsity', 'hoodie', 'blazer', 'tee', 'bomber']
const outfitColors = ['green', 'purple', 'navy', 'cream', 'burgundy', 'mustard', 'black', 'olive']
const headwear = ['none', 'none', 'bucket', 'beanie', 'headphones', 'cap', 'none']
const eyes = ['open', 'sunglasses', 'open', 'round-glasses', 'sleepy', 'visor']
const mouths = ['smile', 'neutral', 'smirk', 'grin']
const accessories = ['none', 'chain', 'none', 'earring', 'pendant']

const adjectives = ['Emerald', 'Sage', 'Ivory', 'Violet', 'Golden', 'Onyx', 'Amber', 'Cobalt', 'Coral', 'Jade', 'Ruby', 'Saffron', 'Indigo', 'Copper', 'Velvet', 'Lunar']
const nouns = ['Ape', 'Nomad', 'Baron', 'Beat', 'Signal', 'Mogul', 'Monk', 'Drifter', 'Pilot', 'Sentinel', 'Echo', 'Rogue', 'Scholar', 'Captain', 'Muse', 'Oracle']

const traitLabel = {
  sunglasses: 'Óculos escuros', 'round-glasses': 'Óculos redondos', visor: 'Viseira neon', sleepy: 'Olhar sereno', open: 'Olhar atento',
  bucket: 'Chapéu bucket', beanie: 'Gorro', headphones: 'Fone de ouvido', cap: 'Boné', none: null,
  varsity: 'Jaqueta college', hoodie: 'Moletom', blazer: 'Blazer', tee: 'Camiseta', bomber: 'Jaqueta bomber',
  chain: 'Corrente', earring: 'Brinco', pendant: 'Pingente',
}
const colorLabel = { green: 'verde', purple: 'roxo', navy: 'marinho', cream: 'creme', burgundy: 'vinho', mustard: 'mostarda', black: 'preto', olive: 'oliva' }
const collectionLabel = { 'arte-digital': 'Arte digital', fotografia: 'Fotografia', musica: 'Música', 'arte-3d': 'Arte 3D', colecionaveis: 'Colecionáveis', esportes: 'Esportes', jogos: 'Jogos', ilustracoes: 'Ilustrações' }

// Itens fixos que reproduzem o Figma
const fixed = [
  { name: 'Emerald Ape', number: 42, art: { species: 'chimp', bg: 'cream', outfit: 'varsity', outfitColor: 'green', headwear: 'none', eyes: 'sunglasses', mouth: 'smile', accessory: 'pendant' }, collection: 'arte-digital', network: 'ethereum', price: 1.1 },
  { name: 'Sage Nomad', number: 69, art: { species: 'gorilla', bg: 'cream', outfit: 'hoodie', outfitColor: 'purple', headwear: 'bucket', eyes: 'open', mouth: 'smirk', accessory: 'none' }, collection: 'fotografia', network: 'polygon', price: 1.48 },
  { name: 'Onyx Mogul', number: 102, art: { species: 'gorilla', bg: 'mint', outfit: 'blazer', outfitColor: 'cream', headwear: 'none', eyes: 'open', mouth: 'neutral', accessory: 'none' }, collection: 'arte-3d', network: 'ethereum', price: 1.98 },
  { name: 'Violet Nomad', number: 14, art: { species: 'silverback', bg: 'cream', outfit: 'hoodie', outfitColor: 'purple', headwear: 'bucket', eyes: 'sleepy', mouth: 'smile', accessory: 'none' }, collection: 'fotografia', network: 'solana', price: 1.2 },
  { name: 'Ivory Baron', number: 88, art: { species: 'gorilla', bg: 'sage', outfit: 'blazer', outfitColor: 'black', headwear: 'none', eyes: 'round-glasses', mouth: 'neutral', accessory: 'none' }, collection: 'colecionaveis', network: 'ethereum', price: 1.79 },
  { name: 'Golden Beat', number: 207, art: { species: 'orangutan', bg: 'cream', outfit: 'bomber', outfitColor: 'cream', headwear: 'headphones', eyes: 'open', mouth: 'grin', accessory: 'none' }, collection: 'musica', network: 'polygon', price: 0.99 },
  { name: 'Golden Signal', number: 198, art: { species: 'orangutan', bg: 'mint', outfit: 'bomber', outfitColor: 'cream', headwear: 'headphones', eyes: 'sleepy', mouth: 'smile', accessory: 'chain' }, collection: 'musica', network: 'ethereum', price: 0.89 },
]

const used = new Set(fixed.map((f) => `${f.name}`))
const items = []
const total = 48
for (let i = 0; i < total; i++) {
  const f = fixed[i]
  let name, number, art, collection, network, price
  if (f) {
    ;({ name, number, art, collection, network, price } = f)
  } else {
    do { name = `${pick(adjectives)} ${pick(nouns)}` } while (used.has(name))
    used.add(name)
    number = int(1, 999)
    art = { species: pick(species), bg: pick(bgs), outfit: pick(outfits), outfitColor: pick(outfitColors), headwear: pick(headwear), eyes: pick(eyes), mouth: pick(mouths), accessory: pick(accessories) }
    collection = collections[i % collections.length]
    network = networks[(i * 7 + int(0, 2)) % 3]
    // spread 0.05 – 12.5 ETH (skewed to lower prices)
    const r = rand()
    price = r < 0.15 ? 0.05 + rand() * 0.4 : r < 0.75 ? 0.5 + rand() * 2 : r < 0.93 ? 2.5 + rand() * 4 : 6.5 + rand() * 6
    price = Math.round(price * 100) / 100
  }
  const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(number).padStart(3, '0')}`
  const base = Math.round(price * 1_000_000)
  const editions = [{ id: 'padrao', label: 'Padrão', price: base, supply: int(40, 200), available: 0 }]
  editions[0].available = Math.max(3, Math.floor(editions[0].supply * (0.15 + rand() * 0.6)))
  if (i % 3 !== 2) {
    const supply = int(8, 25)
    editions.push({ id: 'ouro', label: 'Ouro', price: Math.round(base * 2.2 / 10000) * 10000, supply, available: Math.max(1, Math.floor(supply * rand() * 0.7)) })
  }
  if (i % 4 === 0) {
    const supply = int(1, 3)
    editions.push({ id: 'prova-do-artista', label: 'Prova do artista', price: Math.round(base * 6 / 10000) * 10000, supply, available: i % 8 === 0 ? 0 : 1 })
  }
  const traits = [traitLabel[art.eyes], traitLabel[art.headwear], `${traitLabel[art.outfit]} ${colorLabel[art.outfitColor]}`, traitLabel[art.accessory]].filter(Boolean)
  const creator = creators[i % creators.length]
  const day = 1 + ((i * 11) % 28)
  const month = 1 + ((i * 5) % 10)
  items.push({
    id,
    name: `${name} #${String(number).padStart(3, '0')}`,
    collection,
    network,
    creator,
    art,
    attributes: traits,
    rarity: i % 9 === 0 ? 'Lendária' : i % 4 === 0 ? 'Rara' : i % 3 === 0 ? 'Incomum' : 'Comum',
    description: `${name} #${String(number).padStart(3, '0')} é uma obra digital 1/1 da coleção ${collectionLabel[collection]} criada por ${creator.name}. Cada edição fica registrada nos metadados do token e é verificada na rede ${network === 'ethereum' ? 'Ethereum' : network === 'polygon' ? 'Polygon' : 'Solana'}.`,
    createdAt: new Date(Date.UTC(2026, month - 1, day, 12, 0, 0)).toISOString(),
    sales: int(3, 480),
    rating: Math.round((4 + rand()) * 10) / 10,
    reviewsCount: int(2, 96),
    badge: i === 0 ? 'hot' : i % 10 === 3 ? 'novo' : null,
    featured: i < 4,
    editions,
  })
}
fs.writeFileSync(path.join(root, 'src/mocks/fixtures/catalog.json'), JSON.stringify(items, null, 2) + '\n')
console.log('catalog.json:', items.length, 'NFTs')
