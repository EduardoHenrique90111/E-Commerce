// Gerador de retratos originais (SVG) usados como substitutos das imagens do Figma.
// Estilo: ilustração vetorial de primatas com roupas e acessórios, fundo claro e luz suave.

const PALETTE = {
  bg: {
    cream: ['#f3ead2', '#e2d5b4'],
    mint: ['#d9ebdc', '#b9d6c0'],
    peach: ['#f5dcc0', '#e6bf98'],
    lavender: ['#e6def0', '#cbbfe0'],
    sky: ['#d8e8f0', '#b5cfdd'],
    sand: ['#ece0c4', '#d5c39c'],
    sage: ['#dfe7d0', '#c3d0ae'],
  },
  species: {
    chimp: { fur: '#5b3a24', furLight: '#7a5034', skin: '#e3b48b', skinShade: '#c9926a', muzzle: '#efcaa5', ear: '#d9a37c', tuft: true },
    gorilla: { fur: '#2d2c30', furLight: '#45444a', skin: '#77706f', skinShade: '#5d5756', muzzle: '#958e8b', ear: '#6a6463', tuft: false },
    silverback: { fur: '#7e7e86', furLight: '#a4a4ab', skin: '#55505a', skinShade: '#433f47', muzzle: '#6f6a74', ear: '#4d4851', tuft: false },
    orangutan: { fur: '#c2652a', furLight: '#df8a45', skin: '#e9b17b', skinShade: '#cf9461', muzzle: '#f2c999', ear: '#d79c68', tuft: true, cheeks: true },
    golden: { fur: '#b8862f', furLight: '#d8a94b', skin: '#f0d3a2', skinShade: '#d9b47c', muzzle: '#f6e1bb', ear: '#e2bd88', tuft: true },
  },
  cloth: {
    green: ['#1f6b47', '#16533a'],
    purple: ['#8a63b6', '#6c4a93'],
    navy: ['#28406b', '#1c2f52'],
    cream: ['#efe2c6', '#d6c5a2'],
    burgundy: ['#7c2a36', '#5e1d28'],
    mustard: ['#c99a35', '#a87d24'],
    black: ['#25252b', '#17171b'],
    olive: ['#6f7a48', '#566037'],
  },
}

const sleeveColor = (outfitColor) => (outfitColor === 'cream' ? '#3a6b4f' : '#efe4cb')

export function portraitSvg(art, { size = 400, label = '' } = {}) {
  const sp = PALETTE.species[art.species] ?? PALETTE.species.chimp
  const [bgA, bgB] = PALETTE.bg[art.bg] ?? PALETTE.bg.cream
  const [cl, clDark] = PALETTE.cloth[art.outfitColor] ?? PALETTE.cloth.green
  const uid = `${art.species}-${art.bg}-${art.outfit}-${art.outfitColor}`.replace(/[^a-z0-9-]/g, '')
  const parts = []

  // ---------- defs
  parts.push(`<defs>
    <radialGradient id="bg-${uid}" cx="38%" cy="30%" r="85%">
      <stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/>
    </radialGradient>
    <linearGradient id="cloth-${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${cl}"/><stop offset="1" stop-color="${clDark}"/>
    </linearGradient>
    <radialGradient id="fur-${uid}" cx="40%" cy="30%" r="75%">
      <stop offset="0" stop-color="${sp.furLight}"/><stop offset="1" stop-color="${sp.fur}"/>
    </radialGradient>
    <radialGradient id="skin-${uid}" cx="45%" cy="35%" r="70%">
      <stop offset="0" stop-color="${sp.muzzle}"/><stop offset="1" stop-color="${sp.skin}"/>
    </radialGradient>
    <linearGradient id="lens-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2f5a48"/><stop offset=".55" stop-color="#10261d"/><stop offset="1" stop-color="#0a1612"/>
    </linearGradient>
    <linearGradient id="visor-${uid}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff7ab6"/><stop offset=".5" stop-color="#8f7bff"/><stop offset="1" stop-color="#4fd6ff"/>
    </linearGradient>
    <linearGradient id="shine-${uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>`)

  // ---------- background
  parts.push(`<rect width="400" height="400" fill="url(#bg-${uid})"/>`)
  if (art.bg === 'mint' || art.headwear === 'headphones') {
    parts.push(`<circle cx="200" cy="185" r="150" fill="${bgB}" opacity=".55"/>`)
  }
  // subtle grain dots
  for (let i = 0; i < 14; i++) {
    const x = (i * 97 + 31) % 400
    const y = (i * 61 + 17) % 400
    parts.push(`<circle cx="${x}" cy="${y}" r="1.4" fill="#000" opacity=".05"/>`)
  }

  // ---------- body / clothing
  const body = 'M30 400 C 36 330 92 296 150 290 L 250 290 C 308 296 364 330 370 400 Z'
  if (art.outfit === 'hoodie') {
    // hood behind neck
    parts.push(`<path d="M110 300 C 120 255 280 255 290 300 L 300 330 L 100 330 Z" fill="${clDark}"/>`)
  }
  parts.push(`<path d="${body}" fill="url(#cloth-${uid})"/>`)

  if (art.outfit === 'varsity') {
    const sl = sleeveColor(art.outfitColor)
    parts.push(`<path d="M30 400 C 34 352 58 318 96 302 L 112 400 Z" fill="${sl}"/>`)
    parts.push(`<path d="M370 400 C 366 352 342 318 304 302 L 288 400 Z" fill="${sl}"/>`)
    // collar ribbing
    parts.push(`<path d="M146 292 L 200 352 L 254 292 L 268 298 L 200 372 L 132 298 Z" fill="${sl}"/>`)
    parts.push(`<path d="M138 296 L 200 362 L 262 296" fill="none" stroke="${clDark}" stroke-width="4"/>`)
    // buttons
    for (const y of [382]) parts.push(`<circle cx="200" cy="${y}" r="5" fill="${sl}"/>`)
    // chest letter patch
    parts.push(`<rect x="248" y="338" width="34" height="38" rx="6" fill="${sl}"/><text x="265" y="366" font-family="Georgia, serif" font-size="28" font-weight="700" text-anchor="middle" fill="${cl}">K</text>`)
  } else if (art.outfit === 'hoodie') {
    parts.push(`<path d="M150 292 C 165 330 235 330 250 292" fill="none" stroke="${clDark}" stroke-width="6"/>`)
    parts.push(`<path d="M182 318 L 178 372" stroke="#f3ead8" stroke-width="4" stroke-linecap="round"/><path d="M218 318 L 222 372" stroke="#f3ead8" stroke-width="4" stroke-linecap="round"/>`)
    parts.push(`<circle cx="178" cy="374" r="4" fill="#f3ead8"/><circle cx="222" cy="374" r="4" fill="#f3ead8"/>`)
    parts.push(`<path d="M120 400 Q 200 380 280 400 Z" fill="${clDark}" opacity=".5"/>`)
  } else if (art.outfit === 'blazer') {
    const shirt = art.outfitColor === 'cream' ? '#1f5a43' : '#efe6d4'
    parts.push(`<path d="M150 292 L 250 292 L 236 400 L 164 400 Z" fill="${shirt}"/>`)
    // turtleneck collar
    parts.push(`<path d="M150 284 C 160 310 240 310 250 284 L 252 300 C 240 324 160 324 148 300 Z" fill="${shirt}" stroke="#00000022"/>`)
    // lapels
    parts.push(`<path d="M148 296 L 188 400 L 150 400 L 112 320 Z" fill="${clDark}"/><path d="M252 296 L 212 400 L 250 400 L 288 320 Z" fill="${clDark}"/>`)
    parts.push(`<path d="M148 296 L 132 336 L 160 344 Z" fill="${cl}" opacity=".85"/><path d="M252 296 L 268 336 L 240 344 Z" fill="${cl}" opacity=".85"/>`)
  } else if (art.outfit === 'tee') {
    parts.push(`<path d="M150 292 C 165 318 235 318 250 292" fill="none" stroke="${clDark}" stroke-width="7"/>`)
  } else if (art.outfit === 'bomber') {
    parts.push(`<path d="M140 290 C 160 316 240 316 260 290 L 262 306 C 240 330 160 330 138 306 Z" fill="#3c6b55"/>`)
    parts.push(`<path d="M200 318 L 200 400" stroke="${clDark}" stroke-width="4"/>`)
    parts.push(`<rect x="94" y="340" width="26" height="30" rx="4" fill="#3c6b55" transform="rotate(-12 107 355)"/>`)
    parts.push(`<path d="M30 400 C 36 352 58 322 92 306" fill="none" stroke="${clDark}" stroke-width="5" opacity=".6"/>`)
  }

  // ---------- neck
  parts.push(`<path d="M165 250 L 235 250 L 245 300 C 220 318 180 318 155 300 Z" fill="${sp.fur}"/>`)

  // accessory: chain / pendant
  if (art.accessory === 'chain' || art.accessory === 'pendant') {
    parts.push(`<path d="M160 296 C 172 330 228 330 240 296" fill="none" stroke="#d8b14a" stroke-width="4" stroke-dasharray="6 3"/>`)
    if (art.accessory === 'pendant') parts.push(`<path d="M200 322 l 9 12 l -9 14 l -9 -14 Z" fill="#2f8f6a" stroke="#d8b14a" stroke-width="3"/>`)
  }

  // ---------- head
  const cx = 200
  // ears
  parts.push(`<circle cx="${cx - 92}" cy="172" r="30" fill="url(#fur-${uid})"/><circle cx="${cx - 92}" cy="172" r="18" fill="${sp.ear}"/>`)
  parts.push(`<circle cx="${cx + 92}" cy="172" r="30" fill="url(#fur-${uid})"/><circle cx="${cx + 92}" cy="172" r="18" fill="${sp.ear}"/>`)
  // orangutan cheek pads
  if (sp.cheeks) {
    parts.push(`<ellipse cx="${cx - 86}" cy="190" rx="34" ry="46" fill="${sp.skinShade}"/><ellipse cx="${cx + 86}" cy="190" rx="34" ry="46" fill="${sp.skinShade}"/>`)
  }
  // skull
  parts.push(`<ellipse cx="${cx}" cy="160" rx="96" ry="104" fill="url(#fur-${uid})"/>`)
  // hair tuft
  if (sp.tuft && art.headwear === 'none') {
    parts.push(`<path d="M150 78 C 160 40 190 52 196 30 C 208 54 236 40 236 68 C 254 56 262 82 252 96 Z" fill="${sp.fur}"/>`)
    parts.push(`<path d="M168 70 C 176 52 196 58 200 44" fill="none" stroke="${sp.furLight}" stroke-width="5" stroke-linecap="round"/>`)
  }
  // face mask (upper lobes + muzzle)
  parts.push(`<path d="M${cx} 110 C 170 92 120 104 122 150 C 124 182 140 196 150 206 C 132 230 146 268 ${cx} 270 C 254 268 268 230 250 206 C 260 196 276 182 278 150 C 280 104 230 92 ${cx} 110 Z" fill="url(#skin-${uid})"/>`)
  // brow ridge
  parts.push(`<path d="M134 142 C 150 118 186 122 ${cx} 134 C 214 122 250 118 266 142 C 246 136 220 140 ${cx} 148 C 180 140 154 136 134 142 Z" fill="${sp.skinShade}"/>`)

  // eyes
  const eyeY = 158
  if (art.eyes === 'sunglasses' || art.eyes === 'round-glasses') {
    const lens = art.eyes === 'sunglasses' ? `url(#lens-${uid})` : '#f7f2e6'
    const frame = art.eyes === 'sunglasses' ? '#d4b46a' : '#2a2a2a'
    if (art.eyes === 'round-glasses') {
      for (const ex of [cx - 36, cx + 36]) parts.push(`<circle cx="${ex}" cy="${eyeY}" r="9" fill="#2b1d14"/><circle cx="${ex + 3}" cy="${eyeY - 3}" r="3" fill="#fff"/>`)
    }
    parts.push(`<circle cx="${cx - 38}" cy="${eyeY}" r="27" fill="${lens}" fill-opacity="${art.eyes === 'round-glasses' ? 0.25 : 1}" stroke="${frame}" stroke-width="6"/>`)
    parts.push(`<circle cx="${cx + 38}" cy="${eyeY}" r="27" fill="${lens}" fill-opacity="${art.eyes === 'round-glasses' ? 0.25 : 1}" stroke="${frame}" stroke-width="6"/>`)
    parts.push(`<path d="M${cx - 11} ${eyeY - 4} Q ${cx} ${eyeY - 12} ${cx + 11} ${eyeY - 4}" fill="none" stroke="${frame}" stroke-width="5"/>`)
    parts.push(`<path d="M${cx - 65} ${eyeY - 6} L ${cx - 92} ${eyeY - 14}" stroke="${frame}" stroke-width="5"/><path d="M${cx + 65} ${eyeY - 6} L ${cx + 92} ${eyeY - 14}" stroke="${frame}" stroke-width="5"/>`)
    if (art.eyes === 'sunglasses') {
      parts.push(`<path d="M${cx - 54} ${eyeY - 12} q 10 -8 22 -6" stroke="#fff" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round"/>`)
      parts.push(`<path d="M${cx + 22} ${eyeY - 12} q 10 -8 22 -6" stroke="#fff" stroke-opacity=".55" stroke-width="5" fill="none" stroke-linecap="round"/>`)
    }
  } else if (art.eyes === 'visor') {
    parts.push(`<rect x="${cx - 78}" y="${eyeY - 20}" width="156" height="38" rx="19" fill="url(#visor-${uid})" stroke="#1d1d22" stroke-width="5"/>`)
    parts.push(`<rect x="${cx - 64}" y="${eyeY - 12}" width="60" height="7" rx="3.5" fill="#fff" opacity=".6"/>`)
  } else {
    for (const ex of [cx - 36, cx + 36]) {
      parts.push(`<ellipse cx="${ex}" cy="${eyeY}" rx="16" ry="${art.eyes === 'sleepy' ? 9 : 13}" fill="#fbf6ec"/>`)
      parts.push(`<circle cx="${ex + 2}" cy="${eyeY + (art.eyes === 'sleepy' ? 2 : 1)}" r="${art.eyes === 'sleepy' ? 6.5 : 8.5}" fill="#3a2414"/>`)
      parts.push(`<circle cx="${ex + 5}" cy="${eyeY - 2}" r="2.6" fill="#fff"/>`)
      if (art.eyes === 'sleepy') parts.push(`<path d="M${ex - 18} ${eyeY - 4} Q ${ex} ${eyeY - 14} ${ex + 18} ${eyeY - 4} L ${ex + 18} ${eyeY - 12} L ${ex - 18} ${eyeY - 12} Z" fill="${sp.skinShade}"/>`)
    }
  }

  // muzzle + nose + mouth
  parts.push(`<ellipse cx="${cx}" cy="226" rx="58" ry="44" fill="${sp.muzzle}"/>`)
  parts.push(`<path d="M${cx - 30} 200 C ${cx - 24} 214 ${cx + 24} 214 ${cx + 30} 200" fill="none" stroke="${sp.skinShade}" stroke-width="4" stroke-linecap="round"/>`)
  parts.push(`<ellipse cx="${cx - 12}" cy="${207}" rx="6" ry="4" fill="#3b2418" opacity=".85"/><ellipse cx="${cx + 12}" cy="${207}" rx="6" ry="4" fill="#3b2418" opacity=".85"/>`)
  const mouth = {
    smile: `M${cx - 30} 240 Q ${cx} 258 ${cx + 30} 240`,
    neutral: `M${cx - 26} 244 Q ${cx} 248 ${cx + 26} 244`,
    smirk: `M${cx - 28} 244 Q ${cx + 2} 250 ${cx + 30} 236`,
    grin: `M${cx - 32} 236 Q ${cx} 266 ${cx + 32} 236`,
  }[art.mouth] ?? ''
  parts.push(`<path d="${mouth}" fill="${art.mouth === 'grin' ? '#fff' : 'none'}" stroke="#3b2418" stroke-width="4" stroke-linecap="round"/>`)

  if (art.accessory === 'earring') parts.push(`<circle cx="${cx - 98}" cy="196" r="7" fill="none" stroke="#d8b14a" stroke-width="4"/>`)

  // ---------- headwear
  if (art.headwear === 'bucket') {
    const hat = '#8f9a72'
    parts.push(`<ellipse cx="${cx}" cy="96" rx="128" ry="30" fill="#7b865f"/>`)
    parts.push(`<path d="M104 96 C 104 34 140 18 ${cx} 18 C 260 18 296 34 296 96 Z" fill="${hat}"/>`)
    parts.push(`<path d="M106 84 C 150 98 250 98 294 84 L 296 98 C 250 112 150 112 104 98 Z" fill="#6c7651"/>`)
    parts.push(`<path d="M150 40 C 170 30 200 28 222 32" stroke="#fff" stroke-opacity=".25" stroke-width="6" fill="none" stroke-linecap="round"/>`)
  } else if (art.headwear === 'beanie') {
    const b = art.outfitColor === 'mustard' ? '#2c4a7a' : '#d07a3c'
    parts.push(`<path d="M106 104 C 100 40 150 16 ${cx} 16 C 250 16 300 40 294 104 Z" fill="${b}"/>`)
    parts.push(`<rect x="100" y="86" width="200" height="30" rx="12" fill="${b}" stroke="#00000033" stroke-width="3"/>`)
    for (let x = 116; x < 290; x += 16) parts.push(`<path d="M${x} 90 L ${x} 112" stroke="#00000026" stroke-width="3"/>`)
    parts.push(`<circle cx="${cx}" cy="14" r="14" fill="${b}"/>`)
  } else if (art.headwear === 'headphones') {
    parts.push(`<path d="M98 168 C 92 60 308 60 302 168" fill="none" stroke="#2b3a33" stroke-width="16" stroke-linecap="round"/>`)
    parts.push(`<rect x="84" y="140" width="40" height="66" rx="16" fill="#2f6b52"/><rect x="276" y="140" width="40" height="66" rx="16" fill="#2f6b52"/>`)
    parts.push(`<rect x="92" y="150" width="14" height="46" rx="7" fill="#3f8a6b"/><rect x="294" y="150" width="14" height="46" rx="7" fill="#3f8a6b"/>`)
  } else if (art.headwear === 'cap') {
    const c = art.outfitColor === 'navy' ? '#c4513f' : '#2f4d7d'
    parts.push(`<path d="M108 100 C 104 40 150 22 ${cx} 22 C 254 22 298 44 294 100 Z" fill="${c}"/>`)
    parts.push(`<path d="M150 96 C 200 84 290 88 336 112 C 300 118 220 112 150 110 Z" fill="${c}" stroke="#00000033" stroke-width="3"/>`)
    parts.push(`<circle cx="${cx}" cy="24" r="7" fill="${c}"/>`)
  }

  // light sheen
  parts.push(`<rect width="400" height="400" fill="url(#shine-${uid})"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="${size}" height="${size}" role="img" aria-label="${label}">${parts.join('')}</svg>`
}
