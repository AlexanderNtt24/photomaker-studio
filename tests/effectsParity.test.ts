import { describe, it, expect } from 'vitest'
import { applyEffects, type PixelBuffer } from '../src/core/effects/apply'
import { NO_EFFECTS, type EffectParams } from '../src/core/effects/types'

/** Одна и та же «сцена» (рябь + резкий край), снятая в двух разрешениях. Без алиасинга: период ≥ 35 px даже на предпросмотре. */
function scene(w: number, h: number, cycles = 12): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w
      const v = (y + 0.5) / h
      const val = 128 + 70 * Math.sin(2 * Math.PI * cycles * u) * Math.cos(2 * Math.PI * cycles * 0.625 * v) + (u > 0.5 ? 30 : -30)
      const i = (y * w + x) * 4
      data[i] = data[i + 1] = data[i + 2] = val
      data[i + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

function halve(b: PixelBuffer): PixelBuffer {
  const w = b.width / 2
  const h = b.height / 2
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        const at = (xx: number, yy: number) => b.data[(yy * b.width + xx) * 4 + c]
        data[(y * w + x) * 4 + c] = (at(2 * x, 2 * y) + at(2 * x + 1, 2 * y) + at(2 * x, 2 * y + 1) + at(2 * x + 1, 2 * y + 1)) / 4
      }
  return { data, width: w, height: h }
}

const meanAbsDiff = (a: PixelBuffer, b: PixelBuffer) => {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.data.length; i += 4) {
    sum += Math.abs(a.data[i] - b.data[i])
    n++
  }
  return sum / n
}

/** Насколько «предпросмотр» (низкое разрешение) отличается от «печати» (в 2 раза выше), приведённой к тому же размеру. */
function parity(fx: Partial<EffectParams>, cycles = 12): number {
  const effects = { ...NO_EFFECTS, ...fx }
  const low = applyEffects(scene(450, 300, cycles), effects)
  const high = halve(applyEffects(scene(900, 600, cycles), effects))
  return meanAbsDiff(low, high)
}

// Порог = шум выборки без эффектов (≈0,2), усиленный резкостью, + запас.
const MAX_DIFF = 1.0

describe('preview matches print for the same effect values', () => {
  it('with no effects the two renders differ only by sampling', () => {
    expect(parity({})).toBeLessThan(MAX_DIFF)
  })
  it.each([
    ['blur 6 (as in the «Мягкое» preset)', { blur: 6 }],
    ['blur 20', { blur: 20 }],
    ['blur 60', { blur: 60 }],
    ['sharpen 30', { sharpen: 30 }],
    ['sharpen 80', { sharpen: 80 }],
    ['blur 6 + sharpen 40', { blur: 6, sharpen: 40 }],
  ])('%s', (_name, fx) => {
    expect(parity(fx)).toBeLessThan(MAX_DIFF)
  })

  // Более частый узор: именно на нём старое «радиус не меньше 1» делало предпросмотр заметно мутнее печати.
  it.each([
    ['blur 6 (as in the «Мягкое» preset)', { blur: 6 }],
    ['blur 20', { blur: 20 }],
  ])('fine detail, %s', (_name, fx) => {
    expect(parity(fx, 30)).toBeLessThan(MAX_DIFF)
  })
})
