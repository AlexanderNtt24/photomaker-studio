import { describe, it, expect } from 'vitest'
import { defaultSheet, safeRect, type PhotoLayer } from '../src/core/collage/model'
import { newPhotoLayer } from '../src/core/collage/model'
import { corners, layerInsideRect, polygonsIntersect } from '../src/core/collage/geometry'
import { TEMPLATES, applyTemplate, packIdentical, fillIdentical, fitMessage } from '../src/core/collage/layout'

const sheet = defaultSheet() // A4 portrait, margin 5, gap 4
const size = (widthMm: number, heightMm: number) => ({ widthMm, heightMm })

describe('packIdentical', () => {
  it('90x130 fits 4, centred, no rotation', () => {
    const r = packIdentical(sheet, size(90, 130))
    expect(r.max).toBe(4)
    expect(r.rotated).toBe(false)
    expect(r.cells[0]).toEqual({ x: 13, y: 16.5, width: 90, height: 130 })
    expect(r.cells[1].x).toBeCloseTo(107)
    expect(r.cells[2].y).toBeCloseTo(150.5)
  })
  it('100x150 fits 2 only when rotated', () => {
    const r = packIdentical(sheet, size(100, 150))
    expect(r.max).toBe(2)
    expect(r.rotated).toBe(true)
    expect(r.cells[0]).toMatchObject({ width: 150, height: 100 })
  })
  it('130x180 -> 2 rotated; 30x40 -> 36; 150x210 -> 1; 300x400 -> 0', () => {
    expect(packIdentical(sheet, size(130, 180))).toMatchObject({ max: 2, rotated: true })
    expect(packIdentical(sheet, size(30, 40)).max).toBe(36)
    expect(packIdentical(sheet, size(150, 210)).max).toBe(1)
    const none = packIdentical(sheet, size(300, 400))
    expect(none.max).toBe(0)
    expect(none.cells).toEqual([])
  })
  it('even with no margins and no gap four 10x15 do not fit (300 mm > 297 mm)', () => {
    const bare = { ...sheet, safeMarginMm: 0, gapMm: 0 }
    expect(packIdentical(bare, size(100, 150)).max).toBe(2)
  })
})

describe('fillIdentical', () => {
  it('cycles photos', () => {
    const r = fillIdentical(sheet, size(90, 130), ['a', 'b'], 4)
    expect(r.layers.map((l) => l.imageId)).toEqual(['a', 'b', 'a', 'b'])
    expect(r.placed).toBe(4)
  })
  it("'max' places all that fit", () => {
    expect(fillIdentical(sheet, size(100, 150), ['a'], 'max').layers).toHaveLength(2)
  })
  it('more than fits is capped at max', () => {
    const r = fillIdentical(sheet, size(100, 150), ['a'], 4)
    expect(r.placed).toBe(2)
    expect(r.max).toBe(2)
  })
  it('empty photo list gives empty frames', () => {
    const r = fillIdentical(sheet, size(90, 130), [], 4)
    expect(r.layers).toHaveLength(4)
    expect(r.layers.every((l) => l.imageId === null)).toBe(true)
  })
})

describe('applyTemplate', () => {
  const counts = { '2': 2, '3': 3, '4': 4, '6': 6 } as const
  it('templates have the right number of cells', () => {
    for (const t of TEMPLATES) expect(t.cells).toHaveLength(counts[t.id])
  })
  for (const orientation of ['portrait', 'landscape'] as const) {
    for (const id of ['2', '3', '4', '6'] as const) {
      it(`${id} on ${orientation}: inside safe zone, no overlaps`, () => {
        const sh = { ...sheet, orientation }
        const layers = applyTemplate(sh, id, [])
        expect(layers).toHaveLength(counts[id])
        for (const l of layers) expect(layerInsideRect(l, safeRect(sh))).toBe(true)
        for (let i = 0; i < layers.length; i++)
          for (let j = i + 1; j < layers.length; j++)
            expect(polygonsIntersect(corners(layers[i]), corners(layers[j]))).toBe(false)
      })
    }
  }
  it('4: gaps are exactly 4 mm both ways', () => {
    const [a, b, c] = applyTemplate(sheet, '4', [])
    expect(b.xMm - (a.xMm + a.widthMm)).toBeCloseTo(4)
    expect(c.yMm - (a.yMm + a.heightMm)).toBeCloseTo(4)
  })
  it('keeps photos in order, pads with null and drops extras', () => {
    const ex = (id: string): PhotoLayer => newPhotoLayer({ xMm: 0, yMm: 0, widthMm: 1, heightMm: 1, imageId: id })
    expect(applyTemplate(sheet, '4', [ex('a'), ex('b')]).map((l) => l.imageId)).toEqual(['a', 'b', null, null])
    expect(applyTemplate(sheet, '2', [ex('a'), ex('b'), ex('c'), ex('d')]).map((l) => l.imageId)).toEqual(['a', 'b'])
  })
})

describe('fitMessage', () => {
  it('is null when everything fits', () => expect(fitMessage(4, 4, '9×13')).toBeNull())
  it('explains the maximum', () => {
    const m = fitMessage(2, 4, '10×15')!
    expect(m).toContain('не более 2')
    expect(m).toContain('запрошено 4')
  })
  it('says when nothing fits', () => expect(fitMessage(0, 1, '30×40')).toContain('не помещается'))
})
