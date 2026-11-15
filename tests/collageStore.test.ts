import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useCollageStore } from '../src/modes/collage/collageStore'
import { useLibraryStore } from '../src/core/library/libraryStore'
import { defaultSheet, safeRect, photoWindow, newTextLayer, newStickerLayer, type Layer, type PhotoLayer } from '../src/core/collage/model'
import { layerInsideRect } from '../src/core/collage/geometry'
import type { LoadedImage } from '../src/core/image/load'

const img = (id: string): LoadedImage => {
  const b = { width: 100, height: 100 } as ImageBitmap
  return { id, name: id, width: 100, height: 100, source: new Blob([]), full: b, preview: b }
}
const st = () => useCollageStore.getState()

beforeEach(() => {
  vi.useFakeTimers()
  useLibraryStore.setState({ images: [], selectedId: null, errors: [] })
  useCollageStore.setState({ collage: { sheet: defaultSheet(), layers: [] }, selectedLayerId: null })
  st().resetHistory()
})
afterEach(() => vi.useRealTimers())

describe('layers', () => {
  it('addLayer creates a 90x130 layer inside the safe zone and selects it', () => {
    st().addLayer('a')
    const [l] = st().collage.layers
    expect([l.widthMm, l.heightMm]).toEqual([90, 130])
    expect(layerInsideRect(l, safeRect(st().collage.sheet))).toBe(true)
    expect(st().selectedLayerId).toBe(l.id)
  })
  it('the second layer is cascaded by 5 mm', () => {
    st().addLayer('a')
    st().addLayer('b')
    const [a, b] = st().collage.layers
    expect(b.xMm - a.xMm).toBe(5)
    expect(b.yMm - a.yMm).toBe(5)
  })
  it('many layers stay inside the safe zone', () => {
    for (let i = 0; i < 40; i++) st().addLayer(null)
    const safe = safeRect(st().collage.sheet)
    expect(st().collage.layers.every((l) => layerInsideRect(l, safe))).toBe(true)
  })
  it('updateLayer enforces a 10 mm minimum and ignores NaN', () => {
    st().addLayer('a')
    const id = st().collage.layers[0].id
    st().updateLayer(id, { widthMm: 3 })
    expect(st().collage.layers[0].widthMm).toBe(10)
    const x = st().collage.layers[0].xMm
    st().updateLayer(id, { xMm: NaN })
    expect(st().collage.layers[0].xMm).toBe(x)
  })
  it('a frame wider than allowed does not break the photo window', () => {
    st().addLayer('a')
    const id = st().collage.layers[0].id
    st().updateLayer(id, { frame: { widthMm: 500, color: '#fff' } })
    const w = photoWindow(st().collage.layers[0] as PhotoLayer)
    expect(w.width).toBeGreaterThanOrEqual(2)
    expect(w.height).toBeGreaterThanOrEqual(2)
  })
  it('bringForward and sendBackward reorder', () => {
    st().addLayer('a')
    st().addLayer('b')
    const [a, b] = st().collage.layers.map((l) => l.id)
    st().bringForward(a)
    expect(st().collage.layers.map((l) => l.id)).toEqual([b, a])
    st().sendBackward(a)
    expect(st().collage.layers.map((l) => l.id)).toEqual([a, b])
  })
  it('assignImage and removeLayer', () => {
    st().addLayer(null)
    const id = st().collage.layers[0].id
    st().assignImage(id, 'x')
    expect((st().collage.layers[0] as PhotoLayer).imageId).toBe('x')
    st().removeLayer(id)
    expect(st().collage.layers).toHaveLength(0)
    expect(st().selectedLayerId).toBeNull()
  })
})

describe('sheet', () => {
  it('orientation round trip never leaves a layer off the sheet', () => {
    st().applyTemplate('4')
    st().setOrientation('landscape')
    st().setOrientation('portrait')
    const { widthMm, heightMm } = { widthMm: 210, heightMm: 297 }
    for (const l of st().collage.layers) {
      expect(l.xMm).toBeGreaterThanOrEqual(0)
      expect(l.yMm).toBeGreaterThanOrEqual(0)
      expect(l.xMm + l.widthMm).toBeLessThanOrEqual(widthMm + 1e-6)
      expect(l.yMm + l.heightMm).toBeLessThanOrEqual(heightMm + 1e-6)
    }
  })
  it('gap and margin are clamped to 0..30', () => {
    st().setGap(99)
    expect(st().collage.sheet.gapMm).toBe(30)
    st().setGap(-1)
    expect(st().collage.sheet.gapMm).toBe(0)
    st().setSafeMargin(99)
    expect(st().collage.sheet.safeMarginMm).toBe(30)
  })
  it('sheet dpi is clamped to 150..600 and NaN is ignored', () => {
    st().setDpi(1000)
    expect(st().collage.sheet.dpi).toBe(600)
    st().setDpi(10)
    expect(st().collage.sheet.dpi).toBe(150)
    st().setDpi(NaN)
    expect(st().collage.sheet.dpi).toBe(150)
  })
  it('cut turns marks on, keeps layers; going back keeps background and shadows', () => {
    st().setBackground({ type: 'color', color: '#112233' })
    st().addLayer('a')
    const id = st().collage.layers[0].id
    st().updateLayer(id, { shadow: { enabled: true, blurMm: 3, offsetMm: 1.5, opacity: 0.35 } })
    const before = JSON.stringify(st().collage.layers)
    st().setKind('cut')
    expect(st().collage.sheet.cropMarks).toBe(true)
    expect(JSON.stringify(st().collage.layers)).toBe(before)
    st().setKind('album')
    expect(st().collage.sheet.background).toEqual({ type: 'color', color: '#112233' })
    expect(JSON.stringify(st().collage.layers)).toBe(before)
  })
  it('applyTemplate gives 4 layers and undo restores the previous set', () => {
    st().addLayer('a')
    st().applyTemplate('4')
    expect(st().collage.layers).toHaveLength(4)
    st().undo()
    expect(st().collage.layers).toHaveLength(1)
  })
  it('applyTemplate on an empty sheet takes photos from the library in order', () => {
    useLibraryStore.setState({ images: [img('a'), img('b')], selectedId: 'a' })
    st().applyTemplate('4')
    expect(st().collage.layers.map((l) => (l as PhotoLayer).imageId)).toEqual(['a', 'b', null, null])
  })
  it('applyTemplate keeps the photos already on the sheet, even if the library has others', () => {
    useLibraryStore.setState({ images: [img('a'), img('b'), img('c')], selectedId: 'a' })
    st().addLayer('c')
    st().applyTemplate('4')
    expect(st().collage.layers.map((l) => (l as PhotoLayer).imageId)).toEqual(['c', null, null, null])
  })
  it('fillIdentical uses the selected library photo, or all of them', () => {
    useLibraryStore.setState({ images: [img('a'), img('b')], selectedId: 'a' })
    st().fillIdentical({ widthMm: 90, heightMm: 130 }, 4)
    expect(st().collage.layers.map((l) => (l as PhotoLayer).imageId)).toEqual(['a', 'a', 'a', 'a'])
    useLibraryStore.setState({ selectedId: null })
    st().fillIdentical({ widthMm: 90, heightMm: 130 }, 4)
    expect(st().collage.layers.map((l) => (l as PhotoLayer).imageId)).toEqual(['a', 'b', 'a', 'b'])
  })
})

describe('history', () => {
  it('twenty drag updates become one undo step', () => {
    st().addLayer('a')
    const id = st().collage.layers[0].id
    const x0 = st().collage.layers[0].xMm
    for (let i = 1; i <= 20; i++) st().updateLayer(id, { xMm: x0 + i })
    vi.advanceTimersByTime(1000)
    st().undo()
    expect(st().collage.layers[0].xMm).toBe(x0)
    expect(st().collage.layers).toHaveLength(1) // addLayer остался
  })
  it('undo right after an update, before the idle timer, still undoes it', () => {
    st().addLayer('a')
    const id = st().collage.layers[0].id
    const x0 = st().collage.layers[0].xMm
    st().updateLayer(id, { xMm: x0 + 30 })
    st().undo()
    expect(st().collage.layers[0].xMm).toBe(x0)
  })
  it('undoing an addLayer clears a selection that no longer exists', () => {
    st().addLayer('a')
    st().undo()
    expect(st().collage.layers).toHaveLength(0)
    expect(st().selectedLayerId).toBeNull()
  })
  it('a fresh store has undo disabled and the first edit enables it', () => {
    expect(st().canUndo).toBe(false)
    st().setGap(10)
    expect(st().canUndo).toBe(true)
  })
})

describe('library integration', () => {
  it('removing a photo empties its layers but keeps their size', () => {
    useLibraryStore.setState({ images: [img('a'), img('b')], selectedId: 'a' })
    st().addLayer('a')
    st().addLayer('b')
    const before = st().collage.layers.map((l) => ({ w: l.widthMm, h: l.heightMm }))
    useLibraryStore.getState().remove('a')
    const after = st().collage.layers
    expect(after.map((l) => (l as PhotoLayer).imageId)).toEqual([null, 'b'])
    expect(after.map((l) => ({ w: l.widthMm, h: l.heightMm }))).toEqual(before)
  })
})

describe('non-photo layers', () => {
  const text = () => newTextLayer({ xMm: 20, yMm: 20, widthMm: 80, heightMm: 20 })
  const sticker = () => newStickerLayer({ source: { kind: 'builtin', id: 'star' }, xMm: 120, yMm: 20, widthMm: 40, heightMm: 40 })
  const put = (layers: Layer[]) => {
    useCollageStore.setState({ collage: { sheet: defaultSheet(), layers } })
    st().resetHistory()
  }
  it('applyTemplate and fillIdentical replace only the photos', () => {
    const t = text(), s = sticker()
    put([t, s])
    st().applyTemplate('4')
    expect(st().collage.layers.filter((l) => l.type === 'photo')).toHaveLength(4)
    expect(st().collage.layers.filter((l) => l.type !== 'photo').map((l) => l.id)).toEqual([t.id, s.id])
    st().fillIdentical({ widthMm: 90, heightMm: 130 }, 4)
    expect(st().collage.layers.filter((l) => l.type === 'photo')).toHaveLength(4)
    expect(st().collage.layers.filter((l) => l.type !== 'photo').map((l) => l.id)).toEqual([t.id, s.id])
  })
  it('updateLayer enforces 5 mm minimum for text and stickers, 10 mm for photos', () => {
    const t = text(), s = sticker()
    put([t, s])
    st().updateLayer(t.id, { widthMm: 2 })
    st().updateLayer(s.id, { heightMm: 1 })
    expect(st().collage.layers[0].widthMm).toBe(5)
    expect(st().collage.layers[1].heightMm).toBe(5)
  })
  it('updateLayer ignores fields that belong to another kind', () => {
    const t = text()
    put([t])
    st().updateLayer(t.id, { frame: { widthMm: 9, color: '#000' }, text: 'Привет' })
    const l = st().collage.layers[0] as Record<string, unknown>
    expect(l.text).toBe('Привет')
    expect('frame' in l).toBe(false)
  })
  it('setOrientation clamps layers of every kind into the sheet', () => {
    put([newTextLayer({ xMm: 150, yMm: 250, widthMm: 80, heightMm: 20 })])
    st().setOrientation('landscape')
    const l = st().collage.layers[0]
    expect(l.xMm + l.widthMm).toBeLessThanOrEqual(297 + 1e-6)
    expect(l.yMm + l.heightMm).toBeLessThanOrEqual(210 + 1e-6)
  })
})

describe('hotkey actions', () => {
  const put = (layers: Layer[]) => {
    useCollageStore.setState({ collage: { sheet: defaultSheet(), layers }, selectedLayerId: null })
    st().resetHistory()
  }
  const text = () => newTextLayer({ xMm: 20, yMm: 20, widthMm: 80, heightMm: 20, text: 'Привет' })
  const sticker = () => newStickerLayer({ source: { kind: 'builtin', id: 'star' }, xMm: 120, yMm: 20, widthMm: 40, heightMm: 40 })

  it('duplicateLayer copies a photo, text and sticker on top, 5 mm aside, and selects the copy', () => {
    st().addLayer('a')
    const photo = st().collage.layers[0]
    put([photo, text(), sticker()])
    for (const original of [...st().collage.layers]) {
      const before = st().collage.layers.length
      st().duplicateLayer(original.id)
      const copy = st().collage.layers[st().collage.layers.length - 1]
      expect(st().collage.layers).toHaveLength(before + 1)
      expect(copy.id).not.toBe(original.id)
      expect(copy.type).toBe(original.type)
      expect(copy.xMm).toBe(original.xMm + 5)
      expect(copy.yMm).toBe(original.yMm + 5)
      expect({ ...copy, id: '', xMm: 0, yMm: 0 }).toEqual({ ...original, id: '', xMm: 0, yMm: 0 })
      expect(st().selectedLayerId).toBe(copy.id)
    }
  })
  it('undo removes the duplicate', () => {
    const t = text()
    put([t])
    st().duplicateLayer(t.id)
    st().undo()
    expect(st().collage.layers.map((l) => l.id)).toEqual([t.id])
  })
  it('a duplicate near the bottom right edge stays on the sheet', () => {
    const t = newTextLayer({ xMm: 128, yMm: 275, widthMm: 80, heightMm: 20 })
    put([t])
    st().duplicateLayer(t.id)
    const c = st().collage.layers[1]
    expect(layerInsideRect(c, { x: 0, y: 0, width: 210, height: 297 })).toBe(true)
  })
  it('duplicateLayer of an unknown id changes nothing', () => {
    put([text()])
    st().duplicateLayer('nope')
    expect(st().collage.layers).toHaveLength(1)
  })
  it('nudgeLayer moves by the given mm, stops at the sheet edge and ignores NaN', () => {
    const t = text()
    put([t])
    st().nudgeLayer(t.id, 1, 0)
    expect(st().collage.layers[0].xMm).toBe(21)
    st().nudgeLayer(t.id, -500, 0)
    expect(st().collage.layers[0].xMm).toBe(0)
    st().nudgeLayer(t.id, NaN, NaN)
    expect(st().collage.layers[0].xMm).toBe(0)
    st().nudgeLayer('nope', 1, 1)
  })
  it('a nudge that cannot move the layer does not touch the collage', () => {
    const t = newTextLayer({ xMm: 0, yMm: 20, widthMm: 80, heightMm: 20 })
    put([t])
    const before = st().collage
    st().nudgeLayer(t.id, -1, 0)
    expect(st().collage).toBe(before)
  })
  it('twenty nudges are one undo step', () => {
    const t = text()
    put([t])
    for (let i = 0; i < 20; i++) st().nudgeLayer(t.id, 1, 0)
    vi.advanceTimersByTime(1000)
    st().undo()
    expect(st().collage.layers[0].xMm).toBe(20)
  })
})
