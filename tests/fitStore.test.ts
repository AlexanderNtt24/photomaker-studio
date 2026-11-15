import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LoadedImage, LoadResult } from '../src/core/image/load'

vi.mock('../src/core/image/load', () => ({
  loadImage: vi.fn(async (file: File): Promise<LoadResult> => {
    if (file.name.startsWith('bad')) return { ok: false, name: file.name, error: 'Не удалось прочитать' }
    const bmp = {} as ImageBitmap
    const image: LoadedImage = { id: 'id-' + file.name, name: file.name, width: 10, height: 10, full: bmp, preview: bmp }
    return { ok: true, image }
  }),
}))

import { useFitStore } from '../src/modes/fit/fitStore'

const f = (name: string) => new File(['x'], name)

beforeEach(() => {
  useFitStore.setState({ images: [], selectedId: null, errors: [] })
})

describe('fitStore.addFiles', () => {
  it('keeps going after a broken file and records its error', async () => {
    await useFitStore.getState().addFiles([f('bad.jpg'), f('good.jpg')])
    const s = useFitStore.getState()
    expect(s.images).toHaveLength(1)
    expect(s.errors).toHaveLength(1)
    expect(s.errors[0].name).toBe('bad.jpg')
    expect(s.selectedId).toBe('id-good.jpg')
  })

  it('keeps the current selection when adding more files', async () => {
    await useFitStore.getState().addFiles([f('a.jpg')])
    await useFitStore.getState().addFiles([f('b.jpg')])
    const s = useFitStore.getState()
    expect(s.images.map((i) => i.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(s.selectedId).toBe('id-a.jpg')
  })
})

describe('fitStore.remove', () => {
  beforeEach(async () => {
    await useFitStore.getState().addFiles([f('a.jpg'), f('b.jpg'), f('c.jpg')])
  })

  it('selects the next neighbour when the selected image is removed', () => {
    useFitStore.getState().select('id-b.jpg')
    useFitStore.getState().remove('id-b.jpg')
    expect(useFitStore.getState().selectedId).toBe('id-c.jpg')
  })

  it('selects the previous neighbour when the last selected image is removed', () => {
    useFitStore.getState().select('id-c.jpg')
    useFitStore.getState().remove('id-c.jpg')
    expect(useFitStore.getState().selectedId).toBe('id-b.jpg')
  })

  it('selects nothing when the only image is removed', () => {
    useFitStore.getState().remove('id-a.jpg')
    useFitStore.getState().remove('id-b.jpg')
    useFitStore.getState().remove('id-c.jpg')
    expect(useFitStore.getState().selectedId).toBeNull()
  })

  it('keeps selection when another image is removed', () => {
    useFitStore.getState().remove('id-c.jpg')
    expect(useFitStore.getState().selectedId).toBe('id-a.jpg')
  })
})

describe('fitStore.clearErrors', () => {
  it('empties the error list', async () => {
    await useFitStore.getState().addFiles([f('bad.jpg')])
    useFitStore.getState().clearErrors()
    expect(useFitStore.getState().errors).toEqual([])
  })
})
