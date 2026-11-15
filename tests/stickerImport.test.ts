import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { validateStickerFile, checkSvgText, stickerPixelsOk, importStickerFile, useImportedStickers } from '../src/core/stickers/imported'
import { useCollageStore } from '../src/modes/collage/collageStore'
import { defaultSheet, safeRect, type StickerLayer } from '../src/core/collage/model'
import { layerInsideRect } from '../src/core/collage/geometry'
import { serializeProject, parseProject, restoreProject } from '../src/core/project/project'

const MB = 1024 * 1024
const st = () => useCollageStore.getState()
beforeEach(() => {
  vi.useFakeTimers()
  useImportedStickers.getState().clear()
  useCollageStore.setState({ collage: { sheet: defaultSheet(), layers: [] }, selectedLayerId: null })
  st().resetHistory()
})
afterEach(() => vi.useRealTimers())

describe('validateStickerFile', () => {
  it('accepts png, webp and svg within 5 MB', () => {
    expect(validateStickerFile({ name: 'a.png', type: 'image/png', size: MB })).toBeNull()
    expect(validateStickerFile({ name: 'a.webp', type: 'image/webp', size: MB })).toBeNull()
    expect(validateStickerFile({ name: 'a.svg', type: 'image/svg+xml', size: MB })).toBeNull()
  })
  it('rejects other types and too large files', () => {
    expect(validateStickerFile({ name: 'a.exe', type: 'application/x-msdownload', size: 10 })).toEqual(expect.any(String))
    expect(validateStickerFile({ name: 'a.svg', type: 'image/svg+xml', size: 6 * MB })).toEqual(expect.any(String))
    expect(validateStickerFile({ name: 'a.png', type: 'image/png', size: 0 })).toEqual(expect.any(String))
  })
})

describe('checkSvgText', () => {
  it('accepts an ordinary svg', () => {
    expect(checkSvgText('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect/></svg>')).toBeNull()
  })
  it('rejects scripts, handlers, foreignObject, entities and empty text', () => {
    for (const s of ['<svg><script>1</script></svg>', '<svg onload="x()"></svg>', '<svg><foreignObject/></svg>', '<!DOCTYPE svg [<!ENTITY a "b">]><svg/>', '', '   ', '<html></html>'])
      expect(checkSvgText(s), s).toEqual(expect.any(String))
  })
})

describe('stickerPixelsOk', () => {
  it('limits the side to 4096 and rejects non-positive', () => {
    expect(stickerPixelsOk(5000, 100)).toEqual(expect.any(String))
    expect(stickerPixelsOk(0, 10)).toEqual(expect.any(String))
    expect(stickerPixelsOk(100, 100)).toBeNull()
  })
})

describe('importStickerFile', () => {
  const svgFile = (text: string, name = 's.svg') => new File([text], name, { type: 'image/svg+xml' })
  it('takes an svg with neither viewBox nor size as 1:1', async () => {
    const r = await importStickerFile(svgFile('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'))
    expect(r.ok && r.aspect).toBe(1)
    expect(useImportedStickers.getState().items).toHaveLength(1)
  })
  it('reads the aspect from viewBox, then from width/height', async () => {
    const a = await importStickerFile(svgFile('<svg viewBox="0 0 200 100"></svg>'))
    expect(a.ok && a.aspect).toBe(2)
    const b = await importStickerFile(svgFile('<svg width="30px" height="60"></svg>', 'b.svg'))
    expect(b.ok && b.aspect).toBe(0.5)
  })
  it('does not register a dangerous svg', async () => {
    const r = await importStickerFile(svgFile('<svg><script>1</script></svg>'))
    expect(r.ok).toBe(false)
    expect(useImportedStickers.getState().items).toHaveLength(0)
  })
  it('measures rasters through the supplied measurer and enforces 4096', async () => {
    const png = new File([new Uint8Array([1, 2, 3])], 'p.png', { type: 'image/png' })
    const ok = await importStickerFile(png, async () => ({ width: 300, height: 150 }))
    expect(ok.ok && ok.aspect).toBe(2)
    const big = await importStickerFile(png, async () => ({ width: 5000, height: 100 }))
    expect(big.ok).toBe(false)
    const broken = await importStickerFile(png, async () => { throw new Error('x') })
    expect(broken.ok).toBe(false)
  })
})

describe('addSticker', () => {
  it('adds a 40 mm wide layer with the given aspect inside the safe zone and selects it', () => {
    st().addSticker({ kind: 'builtin', id: 'star' }, 2)
    const l = st().collage.layers[0] as StickerLayer
    expect(l.type).toBe('sticker')
    expect(l.widthMm).toBe(40)
    expect(l.heightMm).toBe(20)
    expect(layerInsideRect(l, safeRect(st().collage.sheet))).toBe(true)
    expect(st().selectedLayerId).toBe(l.id)
  })
  it('a very tall aspect still fits the safe zone', () => {
    st().addSticker({ kind: 'builtin', id: 'star' }, 0.01)
    expect(layerInsideRect(st().collage.layers[0], safeRect(st().collage.sheet))).toBe(true)
  })
})

describe('save and open keep imported sticker bytes (Review Focus 5)', () => {
  it('round-trips the bytes of an imported sticker', async () => {
    const r = await importStickerFile(new File(['<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>'], 's.svg', { type: 'image/svg+xml' }))
    if (!r.ok) throw new Error(r.error)
    st().addSticker({ kind: 'imported', id: r.sticker.id }, r.aspect)
    const bytes = serializeProject(st().collage, [{ id: r.sticker.id, kind: 'sticker', name: r.sticker.name, mime: r.sticker.mime, data: r.sticker.data }])
    useImportedStickers.getState().clear()
    const restored = await restoreProject(parseProject(bytes), async () => { throw new Error('no photos') })
    expect(restored.collage.layers).toHaveLength(1)
    const back = useImportedStickers.getState().byId(r.sticker.id)
    expect(back && Array.from(back.data)).toEqual(Array.from(r.sticker.data))
    expect(back?.mime).toBe('image/svg+xml')
  })
})
