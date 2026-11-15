import type { Background, TextureId } from '../collage/model'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ctx2D = any

export const TEXTURES: { id: TextureId; label: string }[] = [
  { id: 'paper', label: 'Бумага' },
  { id: 'kraft', label: 'Крафт' },
  { id: 'chalk', label: 'Грифельная доска' },
]

type TextureSpec = { base: [number, number, number]; amplitude: number; seed: number }
const SPECS: Record<TextureId, TextureSpec> = {
  paper: { base: [247, 243, 233], amplitude: 8, seed: 11 },
  kraft: { base: [176, 138, 96], amplitude: 16, seed: 23 },
  chalk: { base: [44, 50, 46], amplitude: 10, seed: 37 },
}

/** Детерминированный хэш целочисленной точки решётки в [0, 1). */
function hash(i: number, j: number, seed: number): number {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 2147483647)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Билинейный шум на решётке n×n, заданный долями листа (u, v ∈ [0, 1]). */
function valueNoise(u: number, v: number, n: number, seed: number): number {
  const x = u * n
  const y = v * n
  const i = Math.floor(x)
  const j = Math.floor(y)
  const fx = smooth(x - i)
  const fy = smooth(y - j)
  const a = hash(i, j, seed)
  const b = hash(i + 1, j, seed)
  const c = hash(i, j + 1, seed)
  const d = hash(i + 1, j + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

function drawTexture(ctx: Ctx2D, id: TextureId, w: number, h: number): void {
  const { base, amplitude, seed } = SPECS[id]
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    const v = y / h
    for (let x = 0; x < w; x++) {
      const u = x / w
      // Узор привязан к доле листа, а не к пикселю: на любом dpi выглядит одинаково.
      const n = 0.6 * valueNoise(u, v, 12, seed) + 0.4 * valueNoise(u, v, 48, seed + 1) - 0.5
      const k = n * 2 * amplitude
      const o = (y * w + x) * 4
      d[o] = clamp(base[0] + k)
      d[o + 1] = clamp(base[1] + k)
      d[o + 2] = clamp(base[2] + k)
      d[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))

export function drawBackground(ctx: Ctx2D, bg: Background, w: number, h: number): void {
  if (bg.type === 'color') {
    ctx.fillStyle = bg.color
    ctx.fillRect(0, 0, w, h)
  } else if (bg.type === 'gradient') {
    const a = (bg.angleDeg * Math.PI) / 180
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2
    const cx = w / 2
    const cy = h / 2
    const g = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half)
    g.addColorStop(0, bg.from)
    g.addColorStop(1, bg.to)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  } else {
    drawTexture(ctx, bg.id, w, h)
  }
}
