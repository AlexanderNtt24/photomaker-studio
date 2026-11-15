import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import type { CanvasFactory, RenderSource } from '../src/core/render/renderFit'
import { renderCollage, type AssetLookup, type WindowCache } from '../src/core/render/renderCollage'
import { defaultSheet, newPhotoLayer, newTextLayer, newStickerLayer, type Collage, type PhotoLayer } from '../src/core/collage/model'
import { NO_EFFECTS } from '../src/core/effects/types'

const DPI = 25.4 // 1 px = 1 mm
const create = ((w: number, h: number) => createCanvas(w, h)) as unknown as CanvasFactory

function solid(color: string, w = 40, h = 40): RenderSource {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  return c as unknown as RenderSource
}
const BLUE = solid('#0000ff')
const RED = solid('#ff0000')
const assets: AssetLookup = (id) =>
  id === 'blue' ? { full: BLUE, preview: BLUE } : id === 'red' ? { full: RED, preview: RED } : undefined

const opts = { dpi: DPI, source: 'full' as const, placeholders: false, drawMarks: false }
const px = (c: any, x: number, y: number) => Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data) as number[]

function layer(o: Partial<PhotoLayer> & Pick<PhotoLayer, 'xMm' | 'yMm' | 'widthMm' | 'heightMm'>) {
  return newPhotoLayer({ imageId: 'blue', ...o })
}
function collage(layers: PhotoLayer[], sheet = defaultSheet('album')): Collage {
  return { sheet, layers }
}
const BG = [200, 220, 200, 255]
const albumSheet = () => ({ ...defaultSheet('album'), background: { type: 'color' as const, color: '#c8dcc8' } })

describe('renderCollage', () => {
  it('sheet size follows orientation', () => {
    const p = renderCollage(collage([]), assets, opts, create)
    expect([p.width, p.height]).toEqual([210, 297])
    const l = renderCollage(collage([], { ...defaultSheet(), orientation: 'landscape' }), assets, opts, create)
    expect([l.width, l.height]).toEqual([297, 210])
  })

  it('album: background, frame inside the size, photo window', () => {
    const l = layer({ xMm: 50, yMm: 50, widthMm: 100, heightMm: 150, frame: { widthMm: 5, color: '#ffffff' } })
    const c = renderCollage(collage([l], albumSheet()), assets, opts, create)
    expect(px(c, 0, 0)).toEqual(BG)
    expect(px(c, 52, 52)).toEqual([255, 255, 255, 255])
    expect(px(c, 100, 125)).toEqual([0, 0, 255, 255])
    expect(px(c, 160, 125)).toEqual(BG)
    expect(px(c, 149, 199)).toEqual([255, 255, 255, 255]) // last pixel inside the layer is frame
    expect(px(c, 151, 200)).toEqual(BG) // frame does not grow the layer
  })

  it('cut sheet is white and draws no shadow; album shadow darkens', () => {
    const shadow = { enabled: true, blurMm: 2, offsetMm: 4, opacity: 0.8 }
    const l = layer({ xMm: 50, yMm: 50, widthMm: 100, heightMm: 150, shadow })
    const cut = renderCollage(collage([l], { ...defaultSheet('cut'), background: { type: 'color', color: '#ff0000' } }), assets, opts, create)
    expect(px(cut, 0, 0)).toEqual([255, 255, 255, 255])
    expect(px(cut, 152, 125)).toEqual([255, 255, 255, 255])
    const alb = renderCollage(collage([l], albumSheet()), assets, opts, create)
    expect(px(alb, 152, 125)[0]).toBeLessThan(180)
  })

  it('a rotated layer keeps its shadow falling to the bottom-right of the sheet', () => {
    const shadow = { enabled: true, blurMm: 1, offsetMm: 6, opacity: 1 }
    const l = layer({ xMm: 60, yMm: 60, widthMm: 80, heightMm: 80, rotationDeg: 45, shadow })
    const c = renderCollage(collage([l], albumSheet()), assets, opts, create)
    // ромб с центром (100,100) и полудиагональю 56,6; тень — тот же ромб, сдвинутый на (6,6)
    expect(px(c, 104, 156)[0]).toBeLessThan(120) // вне ромба, но внутри тени
    expect(px(c, 96, 156)[0]).toBeGreaterThan(150) // вне ромба и вне тени
  })

  it('rotates around the centre', () => {
    const l = layer({ xMm: 50, yMm: 50, widthMm: 100, heightMm: 50, rotationDeg: 90 })
    const c = renderCollage(collage([l], albumSheet()), assets, opts, create)
    expect(px(c, 100, 40)).toEqual([0, 0, 255, 255])
    expect(px(c, 60, 60)).toEqual(BG)
  })

  it('corner radius cuts the corner of the photo window', () => {
    const l = layer({ xMm: 50, yMm: 50, widthMm: 100, heightMm: 100, cornerRadiusMm: 10 })
    const c = renderCollage(collage([l], albumSheet()), assets, opts, create)
    expect(px(c, 51, 51)).toEqual(BG)
    expect(px(c, 100, 100)).toEqual([0, 0, 255, 255])
  })

  it('effects touch the photo only, never the frame', () => {
    const l = layer({
      xMm: 50, yMm: 50, widthMm: 100, heightMm: 100,
      frame: { widthMm: 5, color: '#ffffff' },
      effects: { ...NO_EFFECTS, sepia: true },
    })
    const c = renderCollage(collage([l], albumSheet()), assets, opts, create)
    expect(px(c, 52, 52)).toEqual([255, 255, 255, 255])
    expect(px(c, 100, 100)).not.toEqual([0, 0, 255, 255])
  })

  it('a missing photo is skipped, or shown as a placeholder on screen', () => {
    const l = layer({ xMm: 50, yMm: 50, widthMm: 100, heightMm: 100, imageId: 'gone' })
    const off = renderCollage(collage([l], albumSheet()), assets, opts, create)
    expect(px(off, 100, 100)).toEqual(BG)
    const on = renderCollage(collage([l], albumSheet()), assets, { ...opts, placeholders: true }, create)
    expect(px(on, 100, 100)).not.toEqual(BG)
  })

  it('an empty frame (imageId null) is not exported', () => {
    const l = layer({ xMm: 50, yMm: 50, widthMm: 100, heightMm: 100, imageId: null })
    expect(px(renderCollage(collage([l], albumSheet()), assets, opts, create), 100, 100)).toEqual(BG)
  })

  it('draws crop marks only when asked', () => {
    const l = layer({ xMm: 50, yMm: 50, widthMm: 100, heightMm: 150 })
    const hi = { ...opts, dpi: 254 } // 10 px на мм: линия 0,2 мм = 2 px
    const on = renderCollage(collage([l], { ...defaultSheet('cut') }), assets, { ...hi, drawMarks: true }, create)
    const off = renderCollage(collage([l], { ...defaultSheet('cut') }), assets, { ...hi, drawMarks: false }, create)
    // метка от (49,50) до (46,5; 50) мм => пиксель (480, 500)
    expect(px(on, 480, 500)[0]).toBeLessThan(60)
    expect(px(off, 480, 500)).toEqual([255, 255, 255, 255])
  })

  it('does not paint outside the layers when marks are off', () => {
    const c = renderCollage(collage([], albumSheet()), assets, opts, create)
    expect(px(c, 105, 148)).toEqual(BG)
  })

  it('caches a texture or gradient background between renders', () => {
    let calls = 0
    const counting: CanvasFactory = (w, h) => (calls++, create(w, h))
    const cache: WindowCache = new Map()
    const sheet = { ...defaultSheet('album'), background: { type: 'texture' as const, id: 'kraft' as const } }
    const a = renderCollage(collage([], sheet), assets, opts, counting, cache)
    expect(calls).toBe(2) // лист + фон
    calls = 0
    const b = renderCollage(collage([], sheet), assets, opts, counting, cache)
    expect(calls).toBe(1) // только лист
    expect(px(b, 50, 50)).toEqual(px(a, 50, 50))
  })

  it('caches photo windows: moving a layer re-renders only the sheet', () => {
    let calls = 0
    const counting: CanvasFactory = (w, h) => (calls++, create(w, h))
    const cache: WindowCache = new Map()
    const l = layer({ xMm: 10, yMm: 10, widthMm: 50, heightMm: 50 })
    const l2 = layer({ xMm: 80, yMm: 10, widthMm: 50, heightMm: 50, imageId: 'red' })
    renderCollage(collage([l, l2]), assets, opts, counting, cache)
    expect(calls).toBe(3)
    calls = 0
    renderCollage(collage([{ ...l, xMm: 20 }, l2]), assets, opts, counting, cache)
    expect(calls).toBe(1)
  })
})

describe('non-photo layers before their renderers exist', () => {
  it('are skipped without breaking the sheet and get no crop marks', () => {
    const t = newTextLayer({ xMm: 20, yMm: 20, widthMm: 50, heightMm: 20 })
    const s = newStickerLayer({ source: { kind: 'builtin', id: 'star' }, xMm: 80, yMm: 20, widthMm: 40, heightMm: 40 })
    const sheet = { ...defaultSheet('cut'), cropMarks: true }
    const c = renderCollage({ sheet, layers: [t, s] }, assets, { ...opts, drawMarks: true }, create)
    expect(px(c, 0, 0)).toEqual([255, 255, 255, 255])
    expect(px(c, 19, 20)).toEqual([255, 255, 255, 255]) // у угла текста нет метки
  })
})
