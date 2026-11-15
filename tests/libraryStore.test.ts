import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LoadedImage, LoadResult } from '../src/core/image/load'

vi.mock('../src/core/image/load', () => ({
  loadImage: vi.fn(async (file: File): Promise<LoadResult> => {
    if (file.name.startsWith('bad')) return { ok: false, name: file.name, error: 'Не удалось прочитать' }
    const bmp = {} as ImageBitmap
    const image: LoadedImage = { id: 'id-' + file.name, name: file.name, width: 10, height: 10, source: new Blob([]), full: bmp, preview: bmp }
    return { ok: true, image }
  }),
}))

import { useLibraryStore, imageById, onImageRemoved } from '../src/core/library/libraryStore'

const f = (name: string) => new File(['x'], name)

beforeEach(() => {
  useLibraryStore.setState({ images: [], selectedId: null, errors: [] })
})

describe('library.addFiles', () => {
  it('keeps going after a broken file and records its error', async () => {
    await useLibraryStore.getState().addFiles([f('bad.jpg'), f('good.jpg')])
    const s = useLibraryStore.getState()
    expect(s.images).toHaveLength(1)
    expect(s.errors).toHaveLength(1)
    expect(s.errors[0].name).toBe('bad.jpg')
    expect(s.selectedId).toBe('id-good.jpg')
  })

  it('keeps the current selection when adding more files', async () => {
    await useLibraryStore.getState().addFiles([f('a.jpg')])
    await useLibraryStore.getState().addFiles([f('b.jpg')])
    const s = useLibraryStore.getState()
    expect(s.images.map((i) => i.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(s.selectedId).toBe('id-a.jpg')
  })
})

describe('library.remove', () => {
  beforeEach(async () => {
    await useLibraryStore.getState().addFiles([f('a.jpg'), f('b.jpg'), f('c.jpg')])
  })

  it('selects the next neighbour when the selected image is removed', () => {
    useLibraryStore.getState().select('id-b.jpg')
    useLibraryStore.getState().remove('id-b.jpg')
    expect(useLibraryStore.getState().selectedId).toBe('id-c.jpg')
  })

  it('selects the previous neighbour when the last selected image is removed', () => {
    useLibraryStore.getState().select('id-c.jpg')
    useLibraryStore.getState().remove('id-c.jpg')
    expect(useLibraryStore.getState().selectedId).toBe('id-b.jpg')
  })

  it('selects nothing when the only image is removed', () => {
    useLibraryStore.getState().remove('id-a.jpg')
    useLibraryStore.getState().remove('id-b.jpg')
    useLibraryStore.getState().remove('id-c.jpg')
    expect(useLibraryStore.getState().selectedId).toBeNull()
  })

  it('keeps selection when another image is removed', () => {
    useLibraryStore.getState().remove('id-c.jpg')
    expect(useLibraryStore.getState().selectedId).toBe('id-a.jpg')
  })
})

describe('library.clearErrors', () => {
  it('empties the error list', async () => {
    await useLibraryStore.getState().addFiles([f('bad.jpg')])
    useLibraryStore.getState().clearErrors()
    expect(useLibraryStore.getState().errors).toEqual([])
  })
})

describe('imageById', () => {
  it('finds an image by id and tolerates null and unknown ids', async () => {
    await useLibraryStore.getState().addFiles([f('a.jpg')])
    const s = useLibraryStore.getState()
    expect(imageById(s, 'id-a.jpg')?.name).toBe('a.jpg')
    expect(imageById(s, null)).toBeUndefined()
    expect(imageById(s, 'nope')).toBeUndefined()
  })
})

describe('onImageRemoved', () => {
  beforeEach(async () => {
    await useLibraryStore.getState().addFiles([f('a.jpg'), f('b.jpg')])
  })

  it('tells subscribers which image was removed', () => {
    const seen: string[] = []
    const off = onImageRemoved((id) => seen.push(id))
    useLibraryStore.getState().remove('id-b.jpg')
    expect(seen).toEqual(['id-b.jpg'])
    off()
  })

  it('stops notifying after unsubscribe', () => {
    const seen: string[] = []
    const off = onImageRemoved((id) => seen.push(id))
    off()
    useLibraryStore.getState().remove('id-a.jpg')
    expect(seen).toEqual([])
  })

  it('does not notify when the id is not in the library', () => {
    const seen: string[] = []
    const off = onImageRemoved((id) => seen.push(id))
    useLibraryStore.getState().remove('ghost')
    expect(seen).toEqual([])
    off()
  })
})
