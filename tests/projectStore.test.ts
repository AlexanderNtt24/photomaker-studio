import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useCollageStore } from '../src/modes/collage/collageStore'
import { useProjectStore } from '../src/modes/collage/projectStore'
import { defaultSheet, newPhotoLayer, type Collage } from '../src/core/collage/model'

const st = () => useCollageStore.getState()
const proj = () => useProjectStore.getState()
const sample = (): Collage => ({ sheet: defaultSheet(), layers: [newPhotoLayer({ xMm: 10, yMm: 10, widthMm: 90, heightMm: 130, imageId: 'a' })] })

beforeEach(() => {
  vi.useFakeTimers()
  useCollageStore.setState({ collage: { sheet: defaultSheet(), layers: [] }, selectedLayerId: null })
  st().resetHistory()
  proj().reset()
})
afterEach(() => vi.useRealTimers())

describe('loadCollage', () => {
  it('replaces the collage, clears history and selection', () => {
    st().addLayer('x')
    expect(st().canUndo).toBe(true)
    st().loadCollage(sample())
    expect(st().collage.layers).toHaveLength(1)
    expect(st().canUndo).toBe(false)
    expect(st().canRedo).toBe(false)
    expect(st().selectedLayerId).toBeNull()
  })
})

describe('unsaved changes', () => {
  it('an untouched empty project is clean, adding a layer makes it dirty', () => {
    expect(proj().isDirty()).toBe(false)
    st().addLayer('x')
    expect(proj().isDirty()).toBe(true)
  })
  it('opening and saving make it clean; an edit makes it dirty', () => {
    st().loadCollage(sample())
    proj().markSaved('страница.pmstudio')
    expect(proj().isDirty()).toBe(false)
    expect(proj().name).toBe('страница.pmstudio')
    st().updateLayer(st().collage.layers[0].id, { xMm: 40 })
    expect(proj().isDirty()).toBe(true)
  })
  it('undo back to the saved state makes it clean again', () => {
    st().loadCollage(sample())
    proj().markSaved('a.pmstudio')
    st().updateLayer(st().collage.layers[0].id, { xMm: 40 })
    vi.advanceTimersByTime(1000)
    expect(proj().isDirty()).toBe(true)
    st().undo()
    expect(proj().isDirty()).toBe(false)
    st().redo()
    expect(proj().isDirty()).toBe(true)
  })
  it('reset forgets the file name and the saved state', () => {
    proj().markSaved('a.pmstudio')
    proj().reset()
    expect(proj().name).toBeNull()
  })
})
