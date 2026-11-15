import { describe, it, expect, beforeEach } from 'vitest'
import type { LoadedImage } from '../src/core/image/load'
import { useLibraryStore } from '../src/core/library/libraryStore'
import { useFitStore, targetSizeMm, dpiInfo, effectsFor, outputSizeError } from '../src/modes/fit/fitStore'
import { formatFileLabel } from '../src/modes/fit/exportPng'
import { NO_EFFECTS } from '../src/core/effects/types'

function img(id: string, width: number, height: number): LoadedImage {
  const bmp = { width, height } as ImageBitmap
  return { id, name: id + '.jpg', width, height, full: bmp, preview: bmp }
}

beforeEach(() => {
  useLibraryStore.setState({ images: [], selectedId: null, errors: [] })
  useFitStore.setState({
    formatId: '10x15',
    orientation: 'portrait',
    custom: null,
    mode: 'crop',
    dpi: 300,
    marginColor: '#ffffff',
    cropById: {},
    effectsById: {},
  })
})

describe('targetSizeMm', () => {
  it('is 100 x 150 for 10x15 portrait', () => {
    expect(targetSizeMm(useFitStore.getState())).toEqual({ widthMm: 100, heightMm: 150 })
  })

  it('swaps sides for landscape', () => {
    useFitStore.getState().setOrientation('landscape')
    expect(targetSizeMm(useFitStore.getState())).toEqual({ widthMm: 150, heightMm: 100 })
  })

  it('uses the custom size when the custom format is chosen', () => {
    useFitStore.getState().setFormat('custom')
    useFitStore.getState().setCustom({ width: '12', height: '18', unit: 'cm' })
    expect(targetSizeMm(useFitStore.getState())).toEqual({ widthMm: 120, heightMm: 180 })
  })

  it('is null for an invalid custom size', () => {
    useFitStore.getState().setFormat('custom')
    useFitStore.getState().setCustom({ width: '0', height: '18', unit: 'cm' })
    expect(targetSizeMm(useFitStore.getState())).toBeNull()
    useFitStore.getState().setCustom({ width: 'abc', height: '18', unit: 'cm' })
    expect(targetSizeMm(useFitStore.getState())).toBeNull()
  })

  it('is null for custom format before any size is typed', () => {
    useFitStore.getState().setFormat('custom')
    expect(targetSizeMm(useFitStore.getState())).toBeNull()
  })
})

describe('dpiInfo', () => {
  it('is soft for a 1000x1500 photo on 10x15', () => {
    useLibraryStore.setState({ images: [img('a', 1000, 1500)], selectedId: 'a' })
    const info = dpiInfo(useFitStore.getState(), useLibraryStore.getState())
    expect(info?.dpi).toBeCloseTo(254, 0)
    expect(info?.level).toBe('soft')
  })

  it('is strong for a 500x750 photo on 10x15', () => {
    useLibraryStore.setState({ images: [img('a', 500, 750)], selectedId: 'a' })
    expect(dpiInfo(useFitStore.getState(), useLibraryStore.getState())?.level).toBe('strong')
  })

  it('is ok for a big photo', () => {
    useLibraryStore.setState({ images: [img('a', 3213, 5712)], selectedId: 'a' })
    expect(dpiInfo(useFitStore.getState(), useLibraryStore.getState())?.level).toBe('ok')
  })

  it('zooming in a crop lowers the effective dpi', () => {
    useLibraryStore.setState({ images: [img('a', 2000, 3000)], selectedId: 'a' })
    const before = dpiInfo(useFitStore.getState(), useLibraryStore.getState())!.dpi
    useFitStore.getState().setCrop('a', { zoom: 2, cx: 0.5, cy: 0.5 })
    expect(dpiInfo(useFitStore.getState(), useLibraryStore.getState())!.dpi).toBeCloseTo(before / 2, 0)
  })

  it('in contain mode measures the whole photo fitted into the print', () => {
    useLibraryStore.setState({ images: [img('a', 1500, 1000)], selectedId: 'a' })
    useFitStore.setState({ mode: 'contain' })
    // 1500 px на 100 мм ширины (книжный лист 100x150) = 381 dpi
    expect(dpiInfo(useFitStore.getState(), useLibraryStore.getState())?.dpi).toBeCloseTo(381, 0)
  })

  it('is null without a selected photo or with an invalid size', () => {
    expect(dpiInfo(useFitStore.getState(), useLibraryStore.getState())).toBeNull()
    useLibraryStore.setState({ images: [img('a', 1000, 1500)], selectedId: 'a' })
    useFitStore.setState({ formatId: 'custom', custom: null })
    expect(dpiInfo(useFitStore.getState(), useLibraryStore.getState())).toBeNull()
  })
})

describe('setDpi', () => {
  it('clamps to a sensible range', () => {
    useFitStore.getState().setDpi(10)
    expect(useFitStore.getState().dpi).toBe(72)
    useFitStore.getState().setDpi(99999)
    expect(useFitStore.getState().dpi).toBe(1200)
    useFitStore.getState().setDpi(NaN)
    expect(useFitStore.getState().dpi).toBe(1200)
  })
})

describe('effects per photo', () => {
  it('defaults to no effects and keeps each photo separate', () => {
    expect(effectsFor(useFitStore.getState(), 'a')).toEqual(NO_EFFECTS)
    useFitStore.getState().setEffects('a', { ...NO_EFFECTS, sepia: true })
    expect(effectsFor(useFitStore.getState(), 'a').sepia).toBe(true)
    expect(effectsFor(useFitStore.getState(), 'b')).toEqual(NO_EFFECTS)
  })
})

describe('custom size typed with a decimal comma', () => {
  it('reads 12,5 x 17,5 cm as 125 x 175 mm instead of cutting the fraction', () => {
    useFitStore.getState().setFormat('custom')
    useFitStore.getState().setCustom({ width: '12,5', height: '17,5', unit: 'cm' })
    expect(targetSizeMm(useFitStore.getState())).toEqual({ widthMm: 125, heightMm: 175 })
  })
  it('rejects partly numeric input such as 10abc', () => {
    useFitStore.getState().setFormat('custom')
    useFitStore.getState().setCustom({ width: '10abc', height: '15', unit: 'cm' })
    expect(targetSizeMm(useFitStore.getState())).toBeNull()
  })
  it('puts a dot, not a comma, in the file name label', () => {
    useFitStore.getState().setFormat('custom')
    useFitStore.getState().setCustom({ width: '12,5', height: '17,5', unit: 'cm' })
    expect(formatFileLabel(useFitStore.getState())).toBe('12.5x17.5cm')
  })
})

describe('outputSizeError', () => {
  it('is null for 10x15 at 300 dpi', () => {
    expect(outputSizeError(useFitStore.getState())).toBeNull()
  })
  it('explains the problem for a huge custom print', () => {
    useFitStore.getState().setFormat('custom')
    useFitStore.getState().setCustom({ width: '100', height: '100', unit: 'cm' })
    expect(outputSizeError(useFitStore.getState())).toMatch(/слишком большой/i)
  })
  it('is triggered by a high dpi on A4', () => {
    useFitStore.getState().setFormat('21x30')
    useFitStore.getState().setDpi(1200)
    expect(outputSizeError(useFitStore.getState())).not.toBeNull()
  })
})

describe('removing a photo from the library', () => {
  it('forgets its crop and effects in the fit store', () => {
    useLibraryStore.setState({ images: [img('a', 1000, 1500), img('b', 1000, 1500)], selectedId: 'a' })
    useFitStore.getState().setCrop('a', { zoom: 2, cx: 0.4, cy: 0.4 })
    useFitStore.getState().setEffects('a', { ...NO_EFFECTS, sepia: true })
    useFitStore.getState().setCrop('b', { zoom: 3, cx: 0.5, cy: 0.5 })
    useLibraryStore.getState().remove('a')
    const s = useFitStore.getState()
    expect(s.cropById['a']).toBeUndefined()
    expect(s.effectsById['a']).toBeUndefined()
    expect(s.cropById['b']).toBeDefined()
  })
})
