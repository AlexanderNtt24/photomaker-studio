import { describe, it, expect } from 'vitest'
import { defaultSheet, newPhotoLayer, newTextLayer, newStickerLayer, type Collage, type PhotoLayer } from '../src/core/collage/model'
import { collageWarnings, layerDpi } from '../src/core/collage/warnings'

const L = (o: Partial<PhotoLayer> = {}) => newPhotoLayer({ xMm: 20, yMm: 20, widthMm: 100, heightMm: 150, imageId: 'a', ...o })
const col = (layers: PhotoLayer[], kind: 'album' | 'cut' = 'album'): Collage => ({ sheet: defaultSheet(kind), layers })
const IMG = (id: string, width: number, height: number) => ({ id, width, height })
const kinds = (c: Collage, imgs = [IMG('a', 3000, 4500)]) => collageWarnings(c, imgs).map((w) => w.kind)

describe('collageWarnings', () => {
  it('flags a layer 1 mm outside the safe zone', () => {
    expect(kinds(col([L({ xMm: 4 })]))).toContain('outside')
    expect(kinds(col([L({ xMm: 5 })]))).not.toContain('outside')
  })
  it('flags overlaps only on a cut sheet', () => {
    const two = [L({ xMm: 10 }), L({ xMm: 60 })]
    expect(kinds(col(two, 'cut'))).toContain('overlap')
    expect(kinds(col(two, 'album'))).not.toContain('overlap')
  })
  it('flags an empty frame and a photo missing from the library', () => {
    expect(kinds(col([L({ imageId: null })]))).toContain('empty')
    expect(kinds(col([L({ imageId: 'gone' })]))).toContain('missing')
  })
  it('warns below 300 dpi and errors below 150 dpi', () => {
    const soft = collageWarnings(col([L()]), [IMG('a', 1000, 1500)]).find((w) => w.kind === 'low-dpi')!
    expect(soft.level).toBe('warn')
    const strong = collageWarnings(col([L()]), [IMG('a', 500, 750)]).find((w) => w.kind === 'low-dpi')!
    expect(strong.level).toBe('error')
    expect(kinds(col([L()]))).not.toContain('low-dpi')
  })
  it('every warning names its layer', () => {
    const l = L({ imageId: null })
    expect(collageWarnings(col([l]), []).every((w) => w.layerId === l.id)).toBe(true)
  })
})

describe('layerDpi', () => {
  it('is about 254 for 1000 px over 100 mm', () => {
    expect(layerDpi(L(), IMG('a', 1000, 1500))).toBeCloseTo(254, 0)
  })
  it('zoom 2 halves it', () => {
    const l = L({ crop: { zoom: 2, cx: 0.5, cy: 0.5 } })
    expect(layerDpi(l, IMG('a', 1000, 1500))).toBeCloseTo(127, 0)
  })
  it('the frame shrinks the window and raises dpi', () => {
    const l = L({ frame: { widthMm: 10, color: '#fff' } })
    expect(layerDpi(l, IMG('a', 1000, 1500))).toBeGreaterThan(254)
  })
})

describe('text and sticker layers', () => {
  it('flag a text layer outside the safe zone', () => {
    const c: Collage = { sheet: defaultSheet(), layers: [newTextLayer({ xMm: 1, yMm: 20, widthMm: 50, heightMm: 10 })] }
    expect(kinds(c)).toEqual(['outside'])
  })
  it('do not take part in overlap checks on a cut sheet and need no photo', () => {
    const t = newTextLayer({ xMm: 20, yMm: 20, widthMm: 50, heightMm: 20 })
    const s = newStickerLayer({ source: { kind: 'builtin', id: 'star' }, xMm: 30, yMm: 25, widthMm: 40, heightMm: 40 })
    expect(kinds({ sheet: defaultSheet('cut'), layers: [t, s] })).toEqual([])
  })
})
