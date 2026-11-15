import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { drawBackground, TEXTURES } from '../src/core/render/background'
import type { Background } from '../src/core/collage/model'

function render(bg: Background, w = 64, h = 64) {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  drawBackground(ctx, bg, w, h)
  return { ctx, w, h }
}
const px = (r: ReturnType<typeof render>, x: number, y: number) => Array.from(r.ctx.getImageData(x, y, 1, 1).data)

describe('drawBackground', () => {
  it('fills a solid colour', () => {
    expect(px(render({ type: 'color', color: '#336699' }), 10, 10)).toEqual([51, 102, 153, 255])
  })

  it('gradient at 0deg runs left to right', () => {
    const r = render({ type: 'gradient', from: '#000000', to: '#ffffff', angleDeg: 0 }, 100, 20)
    expect(px(r, 0, 10)[0]).toBeLessThan(10)
    expect(px(r, 99, 10)[0]).toBeGreaterThan(245)
    const mid = px(r, 50, 10)[0]
    expect(mid).toBeGreaterThanOrEqual(118)
    expect(mid).toBeLessThanOrEqual(138)
  })

  it('gradient at 90deg runs top to bottom', () => {
    const r = render({ type: 'gradient', from: '#000000', to: '#ffffff', angleDeg: 90 }, 20, 100)
    expect(px(r, 10, 0)[0]).toBeLessThan(10)
    expect(px(r, 10, 99)[0]).toBeGreaterThan(245)
  })

  it('kraft is brownish and not flat', () => {
    const r = render({ type: 'texture', id: 'kraft' })
    const d = r.ctx.getImageData(0, 0, r.w, r.h).data
    let sr = 0, sg = 0, sb = 0
    const lum: number[] = []
    for (let i = 0; i < d.length; i += 4) {
      sr += d[i]; sg += d[i + 1]; sb += d[i + 2]
      lum.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
    }
    const n = lum.length
    expect(sr / n).toBeGreaterThan(sg / n)
    expect(sg / n).toBeGreaterThan(sb / n)
    const mean = lum.reduce((a, b) => a + b, 0) / n
    const sd = Math.sqrt(lum.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
    expect(sd).toBeGreaterThan(1)
  })

  it('chalk is dark', () => {
    const r = render({ type: 'texture', id: 'chalk' })
    const d = r.ctx.getImageData(0, 0, r.w, r.h).data
    let sum = 0
    for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    expect(sum / (d.length / 4)).toBeLessThan(80)
  })

  it('the same texture is byte-identical on every draw', () => {
    const a = render({ type: 'texture', id: 'paper' }).ctx.getImageData(0, 0, 64, 64).data
    const b = render({ type: 'texture', id: 'paper' }).ctx.getImageData(0, 0, 64, 64).data
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it('the pattern scales with the canvas (same look at different dpi)', () => {
    const small = render({ type: 'texture', id: 'kraft' }, 40, 40)
    const big = render({ type: 'texture', id: 'kraft' }, 160, 160)
    // точка на одной и той же доле листа даёт близкий цвет
    const a = px(small, 20, 20)
    const b = px(big, 80, 80)
    for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThan(6)
  })

  it('lists the three textures', () => {
    expect(TEXTURES.map((t) => t.id)).toEqual(['paper', 'kraft', 'chalk'])
  })
})
