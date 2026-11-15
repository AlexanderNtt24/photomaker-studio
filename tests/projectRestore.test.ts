import { describe, it, expect, beforeEach } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { defaultSheet, newPhotoLayer, newTextLayer, newStickerLayer, type Collage } from '../src/core/collage/model'
import { serializeProject, parseProject, restoreProject, type ProjectAssetData } from '../src/core/project/project'
import { useImportedStickers } from '../src/core/stickers/imported'
import { renderCollage, type AssetLookup } from '../src/core/render/renderCollage'
import type { CanvasFactory, RenderSource } from '../src/core/render/renderFit'
import type { LoadedImage } from '../src/core/image/load'
import { useLibraryStore } from '../src/core/library/libraryStore'
import { NO_EFFECTS } from '../src/core/effects/types'

const asset = (id: string, kind: 'photo' | 'sticker'): ProjectAssetData => ({ id, kind, name: id + '.jpg', mime: 'image/jpeg', data: new Uint8Array([1, 2, 3]) })
const fakeImage = (a: ProjectAssetData): LoadedImage => {
  const b = { width: 40, height: 40 } as ImageBitmap
  return { id: a.id, name: a.name, width: 40, height: 40, source: new Blob([a.data as BlobPart]), full: b, preview: b }
}
const L = (imageId: string, x: number) => newPhotoLayer({ xMm: x, yMm: 20, widthMm: 60, heightMm: 80, imageId })

beforeEach(() => useImportedStickers.getState().clear())

describe('restoreProject', () => {
  it('keeps ids, and empties only the frames whose photo cannot be decoded', async () => {
    const c: Collage = { sheet: defaultSheet(), layers: [L('good', 10), L('broken', 80)] }
    const parsed = parseProject(serializeProject(c, [asset('good', 'photo'), asset('broken', 'photo')]))
    const r = await restoreProject(parsed, async (a) => (a.id === 'broken' ? null : fakeImage(a)))
    expect(r.images.map((i) => i.id)).toEqual(['good'])
    expect(r.collage.layers.map((l) => (l as { imageId: string | null }).imageId)).toEqual(['good', null])
    expect(r.collage.layers[1]).toMatchObject({ widthMm: 60, heightMm: 80 })
    expect(r.notes.join(' ')).toContain('broken.jpg')
  })

  it('registers imported stickers from the attachments', async () => {
    const st = newStickerLayer({ source: { kind: 'imported', id: 's1' }, xMm: 10, yMm: 10, widthMm: 30, heightMm: 30 })
    const parsed = parseProject(serializeProject({ sheet: defaultSheet(), layers: [st] }, [{ ...asset('s1', 'sticker'), mime: 'image/svg+xml' }]))
    await restoreProject(parsed, async () => null)
    expect(useImportedStickers.getState().byId('s1')?.mime).toBe('image/svg+xml')
  })

  it('draws the reopened sheet exactly like the saved one', async () => {
    const solid = (color: string) => {
      const cv = createCanvas(40, 40)
      const ctx = cv.getContext('2d')
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 40, 40)
      return cv as unknown as RenderSource
    }
    const blue = solid('#0033cc'), red = solid('#cc0000')
    const lookup: AssetLookup = (id) => (id === 'a' ? { full: blue, preview: blue } : id === 'b' ? { full: red, preview: red } : undefined)
    const a = newPhotoLayer({ xMm: 20, yMm: 20, widthMm: 70, heightMm: 90, imageId: 'a', rotationDeg: 15, frame: { widthMm: 4, color: '#ffeedd' }, effects: { ...NO_EFFECTS, sepia: true } })
    const b = newPhotoLayer({ xMm: 80, yMm: 100, widthMm: 80, heightMm: 60, imageId: 'b', cornerRadiusMm: 6, shadow: { enabled: true, blurMm: 3, offsetMm: 2, opacity: 0.4 } })
    const c: Collage = { sheet: { ...defaultSheet(), background: { type: 'gradient', from: '#fff3e0', to: '#b3e5fc', angleDeg: 45 } }, layers: [a, newTextLayer({ xMm: 10, yMm: 250, widthMm: 80, heightMm: 20 }), b] }
    const parsed = parseProject(serializeProject(c, [asset('a', 'photo'), asset('b', 'photo')]))
    const r = await restoreProject(parsed, async (x) => fakeImage(x))
    expect(r.collage).toEqual(c)
    const create = ((w: number, h: number) => createCanvas(w, h)) as unknown as CanvasFactory
    const o = { dpi: 40, source: 'full' as const, placeholders: false, drawMarks: false }
    const before = renderCollage(c, lookup, o, create) as unknown as { toBuffer(t: string): Buffer }
    const after = renderCollage(r.collage, lookup, o, create) as unknown as { toBuffer(t: string): Buffer }
    expect(Buffer.from(before.toBuffer('image/png')).equals(Buffer.from(after.toBuffer('image/png')))).toBe(true)
  })
})

describe('library addLoaded', () => {
  it('adds photos without changing the selection', () => {
    useLibraryStore.setState({ images: [], selectedId: null, errors: [] })
    useLibraryStore.getState().addLoaded([fakeImage(asset('x', 'photo'))])
    expect(useLibraryStore.getState().images.map((i) => i.id)).toEqual(['x'])
    expect(useLibraryStore.getState().selectedId).toBeNull()
  })
  it('does not add a photo twice', () => {
    useLibraryStore.setState({ images: [], selectedId: null, errors: [] })
    useLibraryStore.getState().addLoaded([fakeImage(asset('x', 'photo'))])
    useLibraryStore.getState().addLoaded([fakeImage(asset('x', 'photo'))])
    expect(useLibraryStore.getState().images).toHaveLength(1)
  })
})
