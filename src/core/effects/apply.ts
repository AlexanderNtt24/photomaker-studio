import type { EffectParams } from './types'

/** Подмножество ImageData: работает и в браузере, и в тестах без DOM. */
export type PixelBuffer = { data: Uint8ClampedArray; width: number; height: number }

export function isIdentity(p: EffectParams): boolean {
  return (
    p.brightness === 0 &&
    p.contrast === 0 &&
    p.saturation === 0 &&
    p.sharpen === 0 &&
    p.blur === 0 &&
    p.vignette === 0 &&
    p.grain === 0 &&
    !p.grayscale &&
    !p.sepia
  )
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Размытие окном с дробным радиусом r: целые отсчёты в окне ±floor(r) берутся с весом 1,
 * два крайних (на расстоянии floor(r)+1) — с весом дробной части. Так размытие растёт плавно и
 * одинаково выглядит и на предпросмотре (900 px), и на печати (3500 px). Скользящая сумма, края повторяются; альфа не трогается.
 */
function boxBlur(src: Uint8ClampedArray, w: number, h: number, halfWidth: number): Uint8ClampedArray {
  // Окно шириной 2·halfWidth пикселей, оцифрованное по центрам пикселей: центральный отсчёт уже «внутри»,
  // поэтому дополнительный радиус равен halfWidth − 0.5. Окно уже одного пикселя размытия не даёт.
  const r = halfWidth - 0.5
  if (r <= 0) return new Uint8ClampedArray(src)
  const ri = Math.floor(r)
  const f = r - ri
  const norm = 2 * ri + 1 + 2 * f
  const tmp = new Float32Array(src.length)
  const out = new Uint8ClampedArray(src.length)
  const cl = (v: number, max: number) => Math.min(max, Math.max(0, v))
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      const row = y * w * 4 + c
      let sum = 0
      for (let k = -ri; k <= ri; k++) sum += src[row + cl(k, w - 1) * 4]
      for (let x = 0; x < w; x++) {
        const edges = f > 0 ? f * (src[row + cl(x - ri - 1, w - 1) * 4] + src[row + cl(x + ri + 1, w - 1) * 4]) : 0
        tmp[row + x * 4] = (sum + edges) / norm
        sum += src[row + cl(x + ri + 1, w - 1) * 4] - src[row + cl(x - ri, w - 1) * 4]
      }
    }
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      const col = x * 4 + c
      let sum = 0
      for (let k = -ri; k <= ri; k++) sum += tmp[col + cl(k, h - 1) * w * 4]
      for (let y = 0; y < h; y++) {
        const edges = f > 0 ? f * (tmp[col + cl(y - ri - 1, h - 1) * w * 4] + tmp[col + cl(y + ri + 1, h - 1) * w * 4]) : 0
        out[col + y * w * 4] = (sum + edges) / norm
        sum += tmp[col + cl(y + ri + 1, h - 1) * w * 4] - tmp[col + cl(y - ri, h - 1) * w * 4]
      }
    }
  }
  for (let i = 3; i < src.length; i += 4) out[i] = src[i]
  return out
}

/**
 * Чистая функция по пикселям (без CSS-фильтров): одинаково работает в предпросмотре и при экспорте.
 * Радиусы размытия и резкости привязаны к размеру кадра, поэтому на разном dpi картинка похожа.
 */
export function applyEffects(img: PixelBuffer, p: EffectParams, seed = 1): PixelBuffer {
  if (isIdentity(p)) return img
  const { width: w, height: h } = img
  let data: Uint8ClampedArray = new Uint8ClampedArray(img.data)
  const long = Math.max(w, h)

  if (p.blur > 0) {
    data = boxBlur(data, w, h, (p.blur / 100) * 0.02 * long)
  }
  if (p.sharpen > 0) {
    const blurred = boxBlur(data, w, h, 0.002 * long)
    const amount = (p.sharpen / 100) * 2
    for (let i = 0; i < data.length; i += 4) {
      for (let c = 0; c < 3; c++) data[i + c] = data[i + c] + amount * (data[i + c] - blurred[i + c])
    }
  }

  const add = p.brightness * 2.55
  const C = p.contrast * 2.55
  const contrastK = (259 * (C + 255)) / (255 * (259 - C))
  const satK = 1 + p.saturation / 100
  const rand = mulberry32(seed)
  const grainAmp = p.grain * 1.28
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]

      if (add !== 0) {
        r += add
        g += add
        b += add
      }
      if (C !== 0) {
        r = contrastK * (r - 128) + 128
        g = contrastK * (g - 128) + 128
        b = contrastK * (b - 128) + 128
      }
      if (satK !== 1) {
        const l = luma(r, g, b)
        r = l + (r - l) * satK
        g = l + (g - l) * satK
        b = l + (b - l) * satK
      }
      if (p.grayscale) {
        r = g = b = luma(r, g, b)
      }
      if (p.sepia) {
        const nr = 0.393 * r + 0.769 * g + 0.189 * b
        const ng = 0.349 * r + 0.686 * g + 0.168 * b
        const nb = 0.272 * r + 0.534 * g + 0.131 * b
        r = nr
        g = ng
        b = nb
      }
      if (p.vignette > 0) {
        const nx = cx > 0 ? (x - cx) / cx : 0
        const ny = cy > 0 ? (y - cy) / cy : 0
        const d = Math.min(1, Math.sqrt(nx * nx + ny * ny) / Math.SQRT2)
        const t = Math.min(1, Math.max(0, (d - 0.35) / 0.65))
        const k = 1 - (p.vignette / 100) * (t * t * (3 - 2 * t))
        r *= k
        g *= k
        b *= k
      }
      if (grainAmp > 0) {
        const n = (rand() - 0.5) * 2 * grainAmp
        r += n
        g += n
        b += n
      }
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
    }
  }
  return { data, width: w, height: h }
}
