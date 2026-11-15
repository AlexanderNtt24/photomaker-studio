import { describe, it, expect, vi } from 'vitest'
import { openProjectFile, type IoDeps } from '../src/modes/collage/projectIo'
import { isFontAvailable } from '../src/core/collage/fontCheck'
import { serializeProject, parseProject, restoreProject, MAX_ASSETS, type ProjectAssetData } from '../src/core/project/project'
import { ProjectError } from '../src/core/project/container'
import { defaultSheet, newStickerLayer, newPhotoLayer, type Collage } from '../src/core/collage/model'
import { useImportedStickers } from '../src/core/stickers/imported'
import { prepareStickers, type StickerDecoder } from '../src/core/stickers/raster'
import type { RenderSource } from '../src/core/render/renderFit'

describe('review #1: a failed open must not become the save target', () => {
  const mk = (data: Uint8Array) => {
    const api = { saveProject: vi.fn(), openProject: vi.fn(async () => ({ name: 'x.pmstudio', data })), commitOpen: vi.fn() }
    const deps: IoDeps = { api, confirm: () => true, decodePhoto: async () => null }
    return { api, deps }
  }
  it('does not commit the path when the file cannot be parsed', async () => {
    const { api, deps } = mk(new Uint8Array([1, 2, 3, 4]))
    expect((await openProjectFile(deps)).status).toBe('error')
    expect(api.commitOpen).not.toHaveBeenCalled()
  })
  it('commits the path after a successful open', async () => {
    const empty = serializeProject({ sheet: defaultSheet(), layers: [] }, [])
    const { api, deps } = mk(empty)
    expect((await openProjectFile(deps)).status).toBe('opened')
    expect(api.commitOpen).toHaveBeenCalledTimes(1)
  })
})

describe('review #2: font availability by measured width', () => {
  // «Есть» шрифт, если его ширина отличается хотя бы от одного запасного семейства.
  const widths = (known: string[]) => (font: string) => {
    const fam = /"([^"]+)"/.exec(font)?.[1]
    if (fam && known.includes(fam)) return 100 + fam.length
    return font.includes('monospace') ? 80 : 90
  }
  it('is true for an installed font and false for an unknown one', () => {
    expect(isFontAvailable('Georgia', widths(['Georgia']))).toBe(true)
    expect(isFontAvailable('NoSuchFont', widths(['Georgia']))).toBe(false)
  })
})

describe('review #3: stickers inside a project get the same checks as imports', () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(33)
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
    const dv = new DataView(b.buffer)
    dv.setUint32(16, w)
    dv.setUint32(20, h)
    return b
  }
  const run = async (assets: ProjectAssetData[]) => {
    useImportedStickers.getState().clear()
    return restoreProject({ collage: { sheet: defaultSheet(), layers: [] }, assets, notes: [] }, async () => null)
  }
  const st = (id: string, mime: string, data: Uint8Array, name = id): ProjectAssetData => ({ id, kind: 'sticker', name, mime, data })
  it('drops a huge-pixel PNG, a script SVG and an unknown type with notes; keeps a good one', async () => {
    const r = await run([
      st('big', 'image/png', png(30000, 30000), 'big.png'),
      st('evil', 'image/svg+xml', new TextEncoder().encode('<svg><script>1</script></svg>'), 'evil.svg'),
      st('exe', 'application/x-msdownload', new Uint8Array([1, 2, 3]), 'a.exe'),
      st('ok', 'image/png', png(100, 100), 'ok.png'),
      st('ok2', 'image/svg+xml', new TextEncoder().encode('<svg viewBox="0 0 1 1"></svg>'), 'ok.svg'),
    ])
    expect(useImportedStickers.getState().items.map((i) => i.id).sort()).toEqual(['ok', 'ok2'])
    expect(r.notes.length).toBe(3)
  })
  it('drops a raster whose header cannot be read', async () => {
    await run([st('junk', 'image/png', new Uint8Array([1, 2, 3, 4, 5]), 'junk.png')])
    expect(useImportedStickers.getState().items).toHaveLength(0)
  })
})

describe('review #4: save refuses what open would refuse', () => {
  const photoAsset = (i: number): ProjectAssetData => ({ id: 'p' + i, kind: 'photo', name: 'p.jpg', mime: 'image/jpeg', data: new Uint8Array([1]) })
  it('too many attachments', () => {
    const n = MAX_ASSETS + 1
    const c: Collage = { sheet: defaultSheet(), layers: Array.from({ length: n }, (_, i) => newPhotoLayer({ xMm: 0, yMm: 0, widthMm: 20, heightMm: 20, imageId: 'p' + i })) }
    expect(() => serializeProject(c, Array.from({ length: n }, (_, i) => photoAsset(i)))).toThrow(ProjectError)
  })
  it('total size above the limit', () => {
    const c: Collage = { sheet: defaultSheet(), layers: [newPhotoLayer({ xMm: 0, yMm: 0, widthMm: 20, heightMm: 20, imageId: 'p0' })] }
    expect(() => serializeProject(c, [{ ...photoAsset(0), data: new Uint8Array(2000) }], { maxBytes: 1000 })).toThrow(/слишком большой/)
  })
})

describe('review #5: parsing does not copy every attachment', () => {
  it('attachments are views on the input buffer', () => {
    const c: Collage = { sheet: defaultSheet(), layers: [newPhotoLayer({ xMm: 0, yMm: 0, widthMm: 20, heightMm: 20, imageId: 'p0' })] }
    const bytes = serializeProject(c, [{ id: 'p0', kind: 'photo', name: 'p.jpg', mime: 'image/jpeg', data: new Uint8Array([1, 2, 3]) }])
    const a = parseProject(bytes).assets[0]
    expect(a.data.buffer).toBe(bytes.buffer)
    expect(Array.from(a.data)).toEqual([1, 2, 3])
  })
})

describe('review #6: sticker rasters are cached between runs', () => {
  it('decodes an unchanged sticker once across two preparations', async () => {
    const decode = vi.fn<StickerDecoder>(async (_b, _m, w, h) => ({ width: w, height: h }) as unknown as RenderSource)
    const c: Collage = { sheet: defaultSheet(), layers: [newStickerLayer({ source: { kind: 'builtin', id: 'star' }, xMm: 10, yMm: 10, widthMm: 30, heightMm: 30 })] }
    const cache = new Map()
    await prepareStickers(c, 100, decode, () => undefined, cache)
    await prepareStickers(c, 100, decode, () => undefined, cache)
    expect(decode).toHaveBeenCalledTimes(1)
  })
})
