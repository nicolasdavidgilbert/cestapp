/**
 * Generates a deterministic SVG avatar based on a seed string (typically an email).
 * The same seed always produces the exact same avatar on any device.
 */

function hashString(str: string): number {
  let h = 1779033703 ^ str.length

  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }

  return h >>> 0
}

function createRng(seed: string): () => number {
  let t = hashString(seed)

  return function () {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr]

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }

  return copy
}

type ProductShape = {
  name: string
  svg: (x: number, y: number, c: string) => string
}

const products: ProductShape[] = [
  {
    name: 'apple',
    svg: (x, y, c) => `
      <circle cx="${x}" cy="${y + 8}" r="10" fill="${c}" />
      <path d="M${x} ${y - 3} C${x + 3} ${y - 12}, ${x + 12} ${y - 10}, ${x + 9} ${y - 2}" fill="#22C55E"/>
      <rect x="${x - 1}" y="${y - 7}" width="3" height="8" rx="1.5" fill="#854D0E"/>
    `,
  },
  {
    name: 'bread',
    svg: (x, y, c) => `
      <rect x="${x - 17}" y="${y}" width="34" height="21" rx="10" fill="${c}" />
      <path d="M${x - 9} ${y + 7} Q${x - 3} ${y + 2} ${x + 3} ${y + 7}" stroke="#92400E" stroke-width="2" fill="none"/>
    `,
  },
  {
    name: 'milk',
    svg: (x, y, c) => `
      <path d="M${x - 10} ${y - 12} H${x + 10} L${x + 7} ${y + 24} H${x - 7} Z" fill="#FFFFFF" stroke="${c}" stroke-width="3"/>
      <rect x="${x - 7}" y="${y}" width="14" height="10" rx="2" fill="${c}" opacity="0.75"/>
    `,
  },
  {
    name: 'carrot',
    svg: (x, y, c) => `
      <path d="M${x - 6} ${y - 4} L${x + 16} ${y + 18} L${x - 12} ${y + 10} Z" fill="${c}" />
      <path d="M${x - 8} ${y - 6} L${x - 18} ${y - 18} M${x - 5} ${y - 8} L${x - 2} ${y - 21} M${x - 2} ${y - 5} L${x + 10} ${y - 17}" stroke="#16A34A" stroke-width="4" stroke-linecap="round"/>
    `,
  },
  {
    name: 'bottle',
    svg: (x, y, c) => `
      <rect x="${x - 7}" y="${y - 18}" width="14" height="8" rx="2" fill="${c}" />
      <rect x="${x - 11}" y="${y - 10}" width="22" height="36" rx="8" fill="${c}" opacity="0.85"/>
      <rect x="${x - 8}" y="${y + 3}" width="16" height="10" rx="3" fill="#FFFFFF" opacity="0.8"/>
    `,
  },
  {
    name: 'box',
    svg: (x, y, c) => `
      <rect x="${x - 14}" y="${y - 8}" width="28" height="28" rx="5" fill="${c}" />
      <path d="M${x - 14} ${y} H${x + 14} M${x} ${y - 8} V${y + 20}" stroke="#FFFFFF" stroke-width="3" opacity="0.7"/>
    `,
  },
  {
    name: 'fish',
    svg: (x, y, c) => `
      <ellipse cx="${x}" cy="${y + 5}" rx="14" ry="9" fill="${c}" />
      <path d="M${x - 14} ${y + 5} L${x - 28} ${y - 4} V${y + 14} Z" fill="${c}" opacity="0.8"/>
      <circle cx="${x + 6}" cy="${y + 3}" r="2" fill="#FFFFFF"/>
    `,
  },
  {
    name: 'cheese',
    svg: (x, y, c) => `
      <path d="M${x - 15} ${y + 16} L${x + 15} ${y + 8} L${x - 15} ${y - 8} Z" fill="${c}" />
      <circle cx="${x - 7}" cy="${y + 5}" r="3" fill="#FFFFFF" opacity="0.55"/>
      <circle cx="${x + 2}" cy="${y + 6}" r="2" fill="#FFFFFF" opacity="0.55"/>
    `,
  },
]

const bgColors = ['#FFF7ED', '#ECFDF5', '#EFF6FF', '#FDF2F8', '#FEFCE8', '#F5F3FF', '#F0FDFA']
const basketColors = ['#F97316', '#D97706', '#16A34A', '#2563EB', '#9333EA', '#DB2777', '#0891B2']
const accentColors = ['#7C2D12', '#14532D', '#1E3A8A', '#581C87', '#831843', '#164E63']
const productColors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#A855F7', '#EC4899', '#84CC16']

const positions = [
  { x: 62, y: 58 },
  { x: 92, y: 48 },
  { x: 124, y: 60 },
  { x: 76, y: 84 },
  { x: 112, y: 84 },
]

export function generateCestaAvatar(seed: string): string {
  const cleanSeed = (seed || 'anonymous-user').trim().toLowerCase()
  const rng = createRng(cleanSeed)

  const bg = pick(bgColors, rng)
  const basket = pick(basketColors, rng)
  const accent = pick(accentColors, rng)

  const shuffledPositions = shuffle(positions, rng)
  const totalProducts = 3 + Math.floor(rng() * 3)
  const shuffledProducts = shuffle(products, rng)

  let productSvg = ''

  for (let i = 0; i < totalProducts; i++) {
    const product = shuffledProducts[i]
    const pos = shuffledPositions[i]
    const color = pick(productColors, rng)

    const dx = Math.floor(rng() * 9) - 4
    const dy = Math.floor(rng() * 9) - 4
    const rotation = Math.floor(rng() * 25) - 12

    productSvg += `
      <g transform="rotate(${rotation} ${pos.x + dx} ${pos.y + dy})">
        ${product.svg(pos.x + dx, pos.y + dy, color)}
      </g>
    `
  }

  const sparkles = `
    <circle cx="${35 + Math.floor(rng() * 20)}" cy="${35 + Math.floor(rng() * 20)}" r="4" fill="${accent}" opacity="0.22" />
    <circle cx="${135 + Math.floor(rng() * 18)}" cy="${35 + Math.floor(rng() * 18)}" r="5" fill="${accent}" opacity="0.16" />
    <circle cx="${140 + Math.floor(rng() * 14)}" cy="${132 + Math.floor(rng() * 16)}" r="6" fill="${accent}" opacity="0.14" />
  `

  const handleStyle = Math.floor(rng() * 3)

  const handle =
    handleStyle === 0
      ? `<path d="M54 76 C58 44, 122 44, 126 76" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity="0.9"/>`
      : handleStyle === 1
        ? `<path d="M50 78 C66 38, 114 38, 130 78" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round" opacity="0.9"/>`
        : `<path d="M58 76 C62 52, 118 52, 122 76" fill="none" stroke="${accent}" stroke-width="11" stroke-linecap="round" opacity="0.9"/>`

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
      <rect width="180" height="180" rx="34" fill="${bg}" />
      ${sparkles}
      ${handle}
      ${productSvg}
      <path d="M42 82 H138 L126 144 H54 Z" fill="${basket}" />
      <path d="M50 94 H130 M48 110 H132 M52 126 H128" stroke="#FFFFFF" stroke-width="5" opacity="0.35" />
      <path d="M64 82 L70 144 M90 82 V144 M116 82 L110 144" stroke="#FFFFFF" stroke-width="5" opacity="0.28" />
      <circle cx="62" cy="148" r="7" fill="${accent}" opacity="0.9" />
      <circle cx="118" cy="148" r="7" fill="${accent}" opacity="0.9" />
    </svg>
  `

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
