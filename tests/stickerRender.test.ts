import { describe, it, expect } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { renderCollage } from '../src/core/render/renderCollage'
import { defaultSheet, newStickerLayer, type Collage, type StickerLayer } from '../src/core/collage/model'
import type { CanvasFactory, RenderSource } from '../src/core/render/renderFit'
import { prepareStickers, MAX_STICKER_SIDE_PX, type StickerDecoder } from '../src/core/stickers/raster'
import { collageWarnings } from '../src/core/collage/warnings'

const DPI = 100
const PX = DPI / 25.4
const create = ((w: number, h: number) => createCanvas(w, h)) as unknown as CanvasFactory
const none = () => undefined
const decode: StickerDecoder = async (bytes, _mime, w, h) => {
  const img = await loadImage(Buffer.from(bytes))
  const c = createCanvas(w, h)
  c.getContext('2d').drawImage(img, 0, 0, w, h)
  return c as unknown as RenderSource
}
const S = (o: Partial<StickerLayer> = {}) =>
  newStickerLayer({ source: { kind: 'builtin', id: 'star' }, xMm: 20, yMm: 20, widthMm: 40, heightMm: 40, ...o })
const alphaAt = (cv: any, x: number, y: number) => cv.getContext('2d').getImageData(x, y, 1, 1).data[3] as number

async function render(l: StickerLayer, kind: 'album' | 'cut' = 'album') {
  const c: Collage = { sheet: defaultSheet(kind), layers: [l] }
  const stickers = await prepareStickers(c, DPI, decode, () => undefined)
  return renderCollage(c, none, { dpi: DPI, source: 'full', placeholders: false, drawMarks: false, stickers }, create) as any
}
const ink = (cv: any, x0 = 0, y0 = 0, x1 = cv.width, y1 = cv.height) => {
  const d = cv.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0).data as Uint8ClampedArray
  let n = 0, sum = 0
  for (let i = 0; i < d.length; i += 4) if (d[i + 2] < 240) { n++; sum += 255 - d[i + 2] }
  return { n, sum }
}

describe('prepareStickers', () => {
  it('rasterizes the built-in star: opaque centre, transparent corner', async () => {
    const l = S({ widthMm: 200 / PX, heightMm: 200 / PX })
    const lookup = await prepareStickers({ sheet: defaultSheet(), layers: [l] }, DPI, decode, () => undefined)
    const r = lookup(l) as any
    expect(r.width).toBe(200)
    expect(alphaAt(r, 100, 100)).toBe(255)
    expect(alphaAt(r, 2, 2)).toBe(0)
  })
  it('caps the side at MAX_STICKER_SIDE_PX instead of failing', async () => {
    const l = S({ widthMm: 200, heightMm: 200 })
    const lookup = await prepareStickers({ sheet: defaultSheet(), layers: [l] }, 600, async (_b, _m, w, h) => ({ width: w, height: h }) as unknown as RenderSource, () => undefined)
    const r = lookup(l)!
    expect(Math.max(r.width, r.height)).toBeLessThanOrEqual(MAX_STICKER_SIDE_PX)
    expect(r.width).toBeGreaterThan(0)
  })
  it('shape is the same at 300 and 600 dpi', async () => {
    for (const dpi of [300, 600]) {
      const l = S({ widthMm: 30, heightMm: 30 })
      const r = (await prepareStickers({ sheet: defaultSheet(), layers: [l] }, dpi, decode, () => undefined))(l) as any
      expect(alphaAt(r, r.width >> 1, r.height >> 1)).toBe(255)
      expect(alphaAt(r, 1, 1)).toBe(0)
    }
  })
  it('a missing imported sticker is simply absent', async () => {
    const l = S({ source: { kind: 'imported', id: 'ghost' } })
    const lookup = await prepareStickers({ sheet: defaultSheet(), layers: [l] }, DPI, decode, () => undefined)
    expect(lookup(l)).toBeUndefined()
  })
  it('a decoder that throws drops that sticker, not the whole export', async () => {
    const l = S()
    const lookup = await prepareStickers({ sheet: defaultSheet(), layers: [l] }, DPI, async () => { throw new Error('bad') }, () => undefined)
    expect(lookup(l)).toBeUndefined()
  })
})

describe('sticker rendering', () => {
  it('draws inside the layer rectangle and not outside', async () => {
    const cv = await render(S())
    const x0 = Math.floor(20 * PX), x1 = Math.ceil(60 * PX)
    expect(ink(cv, x0, x0, x1, x1).n).toBeGreaterThan(100)
    expect(ink(cv, 0, 0, x0 - 1, cv.height).n).toBe(0)
    expect(ink(cv, x1 + 1, 0, cv.width, cv.height).n).toBe(0)
  })
  it('opacity 0.5 is lighter than 1', async () => {
    const full = ink(await render(S({ opacity: 1 }))).sum
    const half = ink(await render(S({ opacity: 0.5 }))).sum
    expect(half).toBeLessThan(full * 0.7)
    expect(half).toBeGreaterThan(0)
  })
  it('a 90° rotation moves a wide sticker into a tall footprint', async () => {
    const wide = { source: { kind: 'builtin', id: 'arrow-straight' } as const, xMm: 60, yMm: 100, widthMm: 80, heightMm: 20 }
    const flat = await render(S(wide))
    const turned = await render(S({ ...wide, rotationDeg: 90 }))
    // центр (100, 110) мм; после поворота ширина 20, высота 80 → полоса по y 70..150
    expect(ink(flat, 0, Math.floor(75 * PX), flat.width, Math.floor(80 * PX)).n).toBe(0)
    expect(ink(turned, 0, Math.floor(75 * PX), turned.width, Math.floor(80 * PX)).n).toBeGreaterThan(0)
  })
  it('nothing is drawn on a cut sheet', async () => {
    expect(ink(await render(S(), 'cut')).n).toBe(0)
  })
  it('a layer with no raster is skipped without failing', () => {
    const c: Collage = { sheet: defaultSheet(), layers: [S()] }
    expect(() => renderCollage(c, none, { dpi: DPI, source: 'full', placeholders: false, drawMarks: false, stickers: () => undefined }, create)).not.toThrow()
  })
})

describe('sticker warnings', () => {
  it('missing imported sticker is flagged, an available one is not', () => {
    const gone = S({ source: { kind: 'imported', id: 'ghost' } })
    const here = S({ source: { kind: 'imported', id: 'here' } })
    const w = collageWarnings({ sheet: defaultSheet(), layers: [gone, here] }, [], { importedAvailable: (id) => id === 'here' })
    expect(w.filter((x) => x.kind === 'missing').map((x) => x.layerId)).toEqual([gone.id])
  })
})
