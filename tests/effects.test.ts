import { describe, it, expect } from 'vitest'
import { applyEffects, type PixelBuffer } from '../src/core/effects/apply'
import { NO_EFFECTS, type EffectParams } from '../src/core/effects/types'

function buf(w: number, h: number, rgba: number[]): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4)
  return { data, width: w, height: h }
}
const fx = (p: Partial<EffectParams>): EffectParams => ({ ...NO_EFFECTS, ...p })
const px = (b: PixelBuffer, i = 0) => Array.from(b.data.slice(i * 4, i * 4 + 4))

describe('applyEffects', () => {
  it('NO_EFFECTS leaves pixels as they are', () => {
    expect(px(applyEffects(buf(1, 1, [200, 100, 50, 255]), NO_EFFECTS))).toEqual([200, 100, 50, 255])
  })

  it('does not mutate the input buffer', () => {
    const src = buf(1, 1, [200, 100, 50, 255])
    applyEffects(src, fx({ grayscale: true }))
    expect(px(src)).toEqual([200, 100, 50, 255])
  })

  it('grayscale uses Rec.709 luma', () => {
    expect(px(applyEffects(buf(1, 1, [200, 100, 50, 255]), fx({ grayscale: true })))).toEqual([118, 118, 118, 255])
  })

  it('brightness never leaves 0..255', () => {
    expect(px(applyEffects(buf(1, 1, [200, 200, 200, 255]), fx({ brightness: 100 })))).toEqual([255, 255, 255, 255])
    expect(px(applyEffects(buf(1, 1, [10, 10, 10, 255]), fx({ brightness: -100 })))).toEqual([0, 0, 0, 255])
  })

  it('contrast pushes light values up and dark values down', () => {
    const light = applyEffects(buf(1, 1, [200, 200, 200, 255]), fx({ contrast: 50 }))
    const dark = applyEffects(buf(1, 1, [50, 50, 50, 255]), fx({ contrast: 50 }))
    expect(px(light)[0]).toBeGreaterThan(200)
    expect(px(dark)[0]).toBeLessThan(50)
  })

  it('saturation -100 removes colour', () => {
    const [r, g, b] = px(applyEffects(buf(1, 1, [200, 100, 50, 255]), fx({ saturation: -100 })))
    expect(r).toBe(g)
    expect(g).toBe(b)
  })

  it('sepia warms a grey pixel (r > g > b)', () => {
    const [r, g, b] = px(applyEffects(buf(1, 1, [100, 100, 100, 255]), fx({ sepia: true })))
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
  })

  it('keeps alpha untouched', () => {
    const out = applyEffects(buf(2, 2, [200, 100, 50, 77]), fx({ grayscale: true, brightness: 20, grain: 30 }), 1)
    for (let i = 0; i < 4; i++) expect(px(out, i)[3]).toBe(77)
  })

  it('grain is reproducible for a seed and changes the image', () => {
    const src = buf(4, 4, [128, 128, 128, 255])
    const a = applyEffects(src, fx({ grain: 50 }), 42)
    const b = applyEffects(src, fx({ grain: 50 }), 42)
    expect(Array.from(a.data)).toEqual(Array.from(b.data))
    expect(Array.from(a.data)).not.toEqual(Array.from(src.data))
  })

  it('vignette darkens corners but not the centre', () => {
    const out = applyEffects(buf(9, 9, [255, 255, 255, 255]), fx({ vignette: 100 }))
    expect(px(out, 0)[0]).toBeLessThan(200)
    expect(px(out, 4 * 9 + 4)[0]).toBe(255)
  })

  it('blur spreads a bright pixel into its neighbours', () => {
    const src = buf(5, 1, [0, 0, 0, 255])
    src.data.set([255, 255, 255, 255], 2 * 4)
    const out = applyEffects(src, fx({ blur: 100 }))
    expect(px(out, 2)[0]).toBeLessThan(255)
    expect(px(out, 1)[0]).toBeGreaterThan(0)
  })

  it('sharpen increases contrast across an edge', () => {
    const src = buf(6, 1, [60, 60, 60, 255])
    for (let i = 3; i < 6; i++) src.data.set([200, 200, 200, 255], i * 4)
    const out = applyEffects(src, fx({ sharpen: 100 }))
    expect(px(out, 2)[0]).toBeLessThan(60)
    expect(px(out, 3)[0]).toBeGreaterThan(200)
  })
})
