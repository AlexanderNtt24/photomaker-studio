import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useCollageStore } from '../src/modes/collage/collageStore'
import { collageWarnings } from '../src/core/collage/warnings'
import { defaultSheet, newPhotoLayer, newTextLayer, safeRect, type TextLayer } from '../src/core/collage/model'
import { layerInsideRect } from '../src/core/collage/geometry'

const st = () => useCollageStore.getState()
beforeEach(() => {
  vi.useFakeTimers()
  useCollageStore.setState({ collage: { sheet: defaultSheet(), layers: [] }, selectedLayerId: null })
  st().resetHistory()
})
afterEach(() => vi.useRealTimers())

describe('addText', () => {
  it('adds an 80x20 mm text layer inside the safe zone and selects it', () => {
    st().addText()
    const [l] = st().collage.layers
    expect(l.type).toBe('text')
    expect([l.widthMm, l.heightMm]).toEqual([80, 20])
    expect(layerInsideRect(l, safeRect(st().collage.sheet))).toBe(true)
    expect(st().selectedLayerId).toBe(l.id)
  })
  it('undo removes it', () => {
    st().addText()
    st().undo()
    expect(st().collage.layers).toHaveLength(0)
    expect(st().selectedLayerId).toBeNull()
  })
  it('stays on the sheet in landscape too', () => {
    st().setOrientation('landscape')
    st().addText()
    expect(layerInsideRect(st().collage.layers[0], safeRect(st().collage.sheet))).toBe(true)
  })
})

describe('editing text', () => {
  const edit = (p: Partial<TextLayer>) => {
    st().addText()
    const id = st().collage.layers[0].id
    st().updateLayer(id, p)
    return st().collage.layers[0] as TextLayer
  }
  it('changes the text', () => expect(edit({ text: 'Привет' }).text).toBe('Привет'))
  it('clamps font size to 4..200', () => {
    expect(edit({ fontSizePt: 1 }).fontSizePt).toBe(4)
    expect(edit({ fontSizePt: 999 }).fontSizePt).toBe(200)
  })
  it('ignores NaN', () => {
    st().addText()
    const id = st().collage.layers[0].id
    st().updateLayer(id, { fontSizePt: NaN })
    expect((st().collage.layers[0] as TextLayer).fontSizePt).toBe(14)
  })
})

describe('font warning', () => {
  const t = () => newTextLayer({ xMm: 20, yMm: 20, widthMm: 80, heightMm: 20 })
  const photo = () => newPhotoLayer({ xMm: 20, yMm: 60, widthMm: 40, heightMm: 40, imageId: null })
  it('warns for a text layer when the font is missing', () => {
    const l = t()
    const w = collageWarnings({ sheet: defaultSheet(), layers: [l] }, [], { fontAvailable: () => false })
    expect(w.filter((x) => x.kind === 'font')).toEqual([
      { layerId: l.id, kind: 'font', level: 'warn', text: 'Шрифта нет на этом компьютере: будет запасной' },
    ])
  })
  it('does not warn about photos', () => {
    const w = collageWarnings({ sheet: defaultSheet(), layers: [photo()] }, [], { fontAvailable: () => false })
    expect(w.some((x) => x.kind === 'font')).toBe(false)
  })
  it('does not warn without the option, or when the font exists', () => {
    const c = { sheet: defaultSheet(), layers: [t()] }
    expect(collageWarnings(c, []).some((x) => x.kind === 'font')).toBe(false)
    expect(collageWarnings(c, [], { fontAvailable: () => true }).some((x) => x.kind === 'font')).toBe(false)
  })
  it('a text layer outside the safe zone gets an outside warning', () => {
    const l = newTextLayer({ xMm: 0, yMm: 0, widthMm: 80, heightMm: 20 })
    const w = collageWarnings({ sheet: defaultSheet(), layers: [l] }, [])
    expect(w.some((x) => x.kind === 'outside' && x.layerId === l.id)).toBe(true)
  })
})
