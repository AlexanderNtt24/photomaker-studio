import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveCurrentProject, openProjectFile, type IoDeps } from '../src/modes/collage/projectIo'
import { useCollageStore } from '../src/modes/collage/collageStore'
import { useProjectStore } from '../src/modes/collage/projectStore'
import { useLibraryStore } from '../src/core/library/libraryStore'
import { useImportedStickers } from '../src/core/stickers/imported'
import { defaultSheet, newPhotoLayer, newStickerLayer, type Collage } from '../src/core/collage/model'
import { parseProject, serializeProject, type ProjectAssetData } from '../src/core/project/project'
import { encodeContainer } from '../src/core/project/container'
import type { LoadedImage } from '../src/core/image/load'

const bmp = { width: 40, height: 40 } as ImageBitmap
const photo = (id: string, bytes: number[]): LoadedImage => ({ id, name: id + '.jpg', width: 40, height: 40, source: new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), full: bmp, preview: bmp })
const collageWith = (imageId: string): Collage => ({ sheet: defaultSheet(), layers: [newPhotoLayer({ xMm: 10, yMm: 10, widthMm: 90, heightMm: 130, imageId })] })
const decodePhoto = async (a: ProjectAssetData) => photo(a.id, Array.from(a.data))

function deps(over: Partial<IoDeps> = {}): IoDeps & { api: { saveProject: ReturnType<typeof vi.fn>; openProject: ReturnType<typeof vi.fn> } } {
  return {
    api: { saveProject: vi.fn(async () => 'страница.pmstudio'), openProject: vi.fn(async () => null) },
    confirm: vi.fn(() => true),
    decodePhoto,
    ...over,
  } as never
}

beforeEach(() => {
  vi.useRealTimers()
  useLibraryStore.setState({ images: [photo('a', [1, 2, 3])], selectedId: 'a', errors: [] })
  useImportedStickers.getState().clear()
  useCollageStore.setState({ collage: collageWith('a'), selectedLayerId: null })
  useCollageStore.getState().resetHistory()
  useProjectStore.getState().reset()
})

describe('saveCurrentProject', () => {
  it('writes a project that parses back, then marks it clean', async () => {
    const d = deps()
    const r = await saveCurrentProject(true, d)
    expect(r.status).toBe('saved')
    const [name, bytes, saveAs] = d.api.saveProject.mock.calls[0] as [string, Uint8Array, boolean]
    expect(name).toMatch(/\.pmstudio$/)
    expect(saveAs).toBe(true)
    const parsed = parseProject(bytes)
    expect(parsed.collage.layers).toHaveLength(1)
    expect(Array.from(parsed.assets[0].data)).toEqual([1, 2, 3])
    expect(useProjectStore.getState().name).toBe('страница.pmstudio')
    expect(useProjectStore.getState().isDirty()).toBe(false)
  })
  it('includes imported stickers used by layers', async () => {
    useImportedStickers.getState().add({ id: 's1', name: 's.svg', mime: 'image/svg+xml', data: new Uint8Array([9]) })
    const c = collageWith('a')
    c.layers.push(newStickerLayer({ source: { kind: 'imported', id: 's1' }, xMm: 120, yMm: 20, widthMm: 30, heightMm: 30 }))
    useCollageStore.setState({ collage: c })
    const d = deps()
    await saveCurrentProject(false, d)
    const parsed = parseProject(d.api.saveProject.mock.calls[0][1] as Uint8Array)
    expect(parsed.assets.map((a) => a.id).sort()).toEqual(['a', 's1'])
    expect(d.api.saveProject.mock.calls[0][2]).toBe(false)
  })
  it('stays dirty when the dialog is cancelled', async () => {
    const d = deps()
    d.api.saveProject.mockResolvedValue(null)
    expect((await saveCurrentProject(true, d)).status).toBe('cancelled')
    expect(useProjectStore.getState().isDirty()).toBe(true)
  })
  it('reports a failing write instead of throwing', async () => {
    const d = deps()
    d.api.saveProject.mockRejectedValue(new Error('диск полон'))
    const r = await saveCurrentProject(true, d)
    expect(r.status).toBe('error')
    expect(r.message).toContain('диск полон')
    expect(useProjectStore.getState().isDirty()).toBe(true)
  })
})

describe('openProjectFile', () => {
  const projectBytes = () => serializeProject(collageWith('z'), [{ id: 'z', kind: 'photo', name: 'z.jpg', mime: 'image/jpeg', data: new Uint8Array([5, 5]) }])

  it('does not even show the dialog when the user keeps unsaved work', async () => {
    const d = deps({ confirm: vi.fn(() => false) })
    expect((await openProjectFile(d)).status).toBe('cancelled')
    expect(d.api.openProject).not.toHaveBeenCalled()
  })
  it('replaces the sheet, adds photos with their ids and marks the project clean', async () => {
    const d = deps()
    d.api.openProject.mockResolvedValue({ name: 'альбом.pmstudio', data: projectBytes() })
    const r = await openProjectFile(d)
    expect(r.status).toBe('opened')
    expect((useCollageStore.getState().collage.layers[0] as { imageId: string }).imageId).toBe('z')
    expect(useLibraryStore.getState().images.map((i) => i.id)).toEqual(['a', 'z'])
    expect(useProjectStore.getState().name).toBe('альбом.pmstudio')
    expect(useProjectStore.getState().isDirty()).toBe(false)
    expect(useCollageStore.getState().canUndo).toBe(false)
  })
  it('leaves the current work untouched on a corrupt file', async () => {
    const before = useCollageStore.getState().collage
    const d = deps()
    d.api.openProject.mockResolvedValue({ name: 'x.pmstudio', data: new Uint8Array([1, 2, 3, 4]) })
    const r = await openProjectFile(d)
    expect(r.status).toBe('error')
    expect(r.message).toContain('не файл проекта')
    expect(useCollageStore.getState().collage).toBe(before)
    expect(useLibraryStore.getState().images.map((i) => i.id)).toEqual(['a'])
  })
  it('explains a project from a newer version', async () => {
    const data = encodeContainer({}, [])
    new DataView(data.buffer).setUint32(8, 99, true)
    const d = deps()
    d.api.openProject.mockResolvedValue({ name: 'x.pmstudio', data })
    expect((await openProjectFile(d)).message).toContain('более новой версии')
  })
  it('reports when the app has no file access', async () => {
    const r = await openProjectFile({ ...deps(), api: undefined })
    expect(r.status).toBe('error')
  })
})
