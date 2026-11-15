import { describe, it, expect } from 'vitest'
import { validateCollage } from '../src/core/project/validate'
import { defaultSheet, newPhotoLayer, newTextLayer, newStickerLayer } from '../src/core/collage/model'

const good = () => ({
  sheet: defaultSheet(),
  layers: [newPhotoLayer({ xMm: 10, yMm: 10, widthMm: 90, heightMm: 130, imageId: 'a' })],
})
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

describe('validateCollage', () => {
  it('accepts a valid collage unchanged', () => {
    const c = good()
    const r = validateCollage(clone(c))
    expect(r.collage).toEqual(c)
    expect(r.notes).toEqual([])
  })

  it('drops a layer whose geometry is not a finite number, and says so', () => {
    const c = clone(good()) as any
    c.layers.push({ ...c.layers[0], id: 'bad', xMm: 'левее' }, { ...c.layers[0], id: 'nan', widthMm: null })
    const r = validateCollage(c)
    expect(r.collage.layers).toHaveLength(1)
    expect(r.notes.length).toBe(2)
  })

  it('drops layers of an unknown type', () => {
    const c = clone(good()) as any
    c.layers.push({ id: 'v', type: 'video', xMm: 0, yMm: 0, widthMm: 50, heightMm: 50, rotationDeg: 0 })
    const r = validateCollage(c)
    expect(r.collage.layers).toHaveLength(1)
    expect(r.notes.join(' ')).toContain('video')
  })

  it('clamps sheet values to their allowed ranges', () => {
    const c = clone(good()) as any
    Object.assign(c.sheet, { dpi: 9999, safeMarginMm: 500, gapMm: -4 })
    const s = validateCollage(c).collage.sheet
    expect([s.dpi, s.safeMarginMm, s.gapMm]).toEqual([600, 30, 0])
  })

  it('falls back to a default sheet for garbage', () => {
    for (const raw of [null, 42, 'x', {}, { sheet: 5, layers: 'no' }]) {
      const r = validateCollage(raw)
      expect(r.collage.layers).toEqual([])
      expect(r.collage.sheet).toEqual(defaultSheet())
    }
  })

  it('truncates a text to 5000 characters and keeps at most 500 layers', () => {
    const t = newTextLayer({ xMm: 10, yMm: 10, widthMm: 80, heightMm: 20, text: 'я'.repeat(6000) })
    expect((validateCollage({ sheet: defaultSheet(), layers: [t] }).collage.layers[0] as any).text).toHaveLength(5000)
    const many = Array.from({ length: 600 }, () => newStickerLayer({ source: { kind: 'builtin', id: 's' }, xMm: 10, yMm: 10, widthMm: 20, heightMm: 20 }))
    expect(validateCollage({ sheet: defaultSheet(), layers: many }).collage.layers).toHaveLength(500)
  })

  it('replaces colours that are not colours, and clamps opacity and sizes', () => {
    const t = clone(newTextLayer({ xMm: 10, yMm: 10, widthMm: 80, heightMm: 20 })) as any
    Object.assign(t, { color: 'url(http://evil)', opacity: 7, fontSizePt: 1, widthMm: 0.1 })
    const out = validateCollage({ sheet: defaultSheet(), layers: [t] }).collage.layers[0] as any
    expect(out.color).toBe('#333333')
    expect(out.opacity).toBe(1)
    expect(out.fontSizePt).toBe(4)
    expect(out.widthMm).toBe(5)
  })

  it('gives duplicated ids new ones so layers stay addressable', () => {
    const a = newStickerLayer({ source: { kind: 'builtin', id: 's' }, xMm: 10, yMm: 10, widthMm: 20, heightMm: 20 })
    const r = validateCollage({ sheet: defaultSheet(), layers: [a, { ...a }] })
    expect(new Set(r.collage.layers.map((l) => l.id)).size).toBe(2)
  })
})
