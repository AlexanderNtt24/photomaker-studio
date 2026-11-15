import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { renderCollage, printedLayers } from '../src/core/render/renderCollage'
import { defaultSheet, newTextLayer, type Collage, type TextLayer } from '../src/core/collage/model'
import type { CanvasFactory } from '../src/core/render/renderFit'

const DPI = 100
const PX = DPI / 25.4
const create = ((w: number, h: number) => createCanvas(w, h)) as unknown as CanvasFactory
const opts = { dpi: DPI, source: 'full' as const, placeholders: false, drawMarks: false }
const none = () => undefined

function draw(layer: TextLayer, kind: 'album' | 'cut' = 'album') {
  const c: Collage = { sheet: defaultSheet(kind), layers: [layer] }
  const out = renderCollage(c, none, opts, create) as unknown as { width: number; height: number; getContext(t: '2d'): any }
  const d = out.getContext('2d').getImageData(0, 0, out.width, out.height).data as Uint8ClampedArray
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, dark = 0
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const i = (y * out.width + x) * 4
      if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) {
        dark += 255 - d[i]
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      }
    }
  return { minX, minY, maxX, maxY, dark, any: maxX >= 0 }
}
const T = (o: Partial<TextLayer> = {}) =>
  newTextLayer({ xMm: 20, yMm: 20, widthMm: 80, heightMm: 30, color: '#000000', text: 'Привет, мир', ...o })

describe('text layer rendering', () => {
  it('draws inside the layer box and nowhere else', () => {
    const r = draw(T())
    expect(r.any).toBe(true)
    expect(r.minX).toBeGreaterThanOrEqual(Math.floor(20 * PX) - 1)
    expect(r.minY).toBeGreaterThanOrEqual(Math.floor(20 * PX) - 1)
    expect(r.maxX).toBeLessThanOrEqual(Math.ceil(100 * PX) + 1)
    expect(r.maxY).toBeLessThanOrEqual(Math.ceil(50 * PX) + 1)
  })
  it('a very long text is clipped to the box', () => {
    const r = draw(T({ text: 'слово '.repeat(800), fontSizePt: 30 }))
    expect(r.any).toBe(true)
    expect(r.maxX).toBeLessThanOrEqual(Math.ceil(100 * PX) + 1)
    expect(r.maxY).toBeLessThanOrEqual(Math.ceil(50 * PX) + 1)
  })
  it('one word wider than the box does not spill out', () => {
    const r = draw(T({ text: 'Превысокомногорассматривающийся'.repeat(3), fontSizePt: 24 }))
    expect(r.maxX).toBeLessThanOrEqual(Math.ceil(100 * PX) + 1)
  })
  it('empty and blank text draw nothing', () => {
    expect(draw(T({ text: '' })).any).toBe(false)
    expect(draw(T({ text: '  \n ' })).any).toBe(false)
  })
  it('is not printed on a cut sheet', () => {
    expect(draw(T(), 'cut').any).toBe(false)
  })
  it('opacity lightens the text', () => {
    const full = draw(T({ opacity: 1 })).dark
    const half = draw(T({ opacity: 0.5 })).dark
    expect(half).toBeLessThan(full * 0.7)
    expect(half).toBeGreaterThan(0)
  })
  it('rotates around the centre of the box', () => {
    const r = draw(T({ xMm: 50, yMm: 50, widthMm: 80, heightMm: 20, rotationDeg: 90, text: 'ААААААААААААААААААА' }))
    // после поворота рамка занимает x∈[80,100], y∈[20,100] мм
    expect(r.maxX).toBeLessThanOrEqual(Math.ceil(100 * PX) + 1)
    expect(r.minX).toBeGreaterThanOrEqual(Math.floor(80 * PX) - 1)
    expect(r.minY).toBeLessThan(Math.ceil(60 * PX))
  })
  it('right alignment pushes the text to the right edge', () => {
    const left = draw(T({ text: 'Привет', align: 'left' }))
    const right = draw(T({ text: 'Привет', align: 'right' }))
    expect(right.minX).toBeGreaterThan(left.minX + 20)
  })
  it('survives the smallest allowed box and a huge font', () => {
    expect(() => draw(T({ widthMm: 5, heightMm: 5, fontSizePt: 200 }))).not.toThrow()
  })
  it('crop marks ignore text layers', () => {
    const c: Collage = { sheet: defaultSheet('cut'), layers: [T()] }
    expect(printedLayers(c, none, true)).toEqual([])
  })
})
