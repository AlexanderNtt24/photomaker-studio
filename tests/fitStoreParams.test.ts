import { describe, it, expect, beforeEach } from 'vitest'
import type { LoadedImage } from '../src/core/image/load'
import { useFitStore, targetSizeMm, dpiInfo } from '../src/modes/fit/fitStore'

function img(id: string, width: number, height: number): LoadedImage {
  const bmp = { width, height } as ImageBitmap
  return { id, name: id + '.jpg', width, height, full: bmp, preview: bmp }
}

beforeEach(() => {
  useFitStore.setState({
    images: [],
    selectedId: null,
    errors: [],
    formatId: '10x15',
    orientation: 'portrait',
    custom: null,
    mode: 'crop',
    dpi: 300,
    marginColor: '#ffffff',
    cropById: {},
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
    useFitStore.setState({ images: [img('a', 1000, 1500)], selectedId: 'a' })
    const info = dpiInfo(useFitStore.getState())
    expect(info?.dpi).toBeCloseTo(254, 0)
    expect(info?.level).toBe('soft')
  })

  it('is strong for a 500x750 photo on 10x15', () => {
    useFitStore.setState({ images: [img('a', 500, 750)], selectedId: 'a' })
    expect(dpiInfo(useFitStore.getState())?.level).toBe('strong')
  })

  it('is ok for a big photo', () => {
    useFitStore.setState({ images: [img('a', 3213, 5712)], selectedId: 'a' })
    expect(dpiInfo(useFitStore.getState())?.level).toBe('ok')
  })

  it('zooming in a crop lowers the effective dpi', () => {
    useFitStore.setState({ images: [img('a', 2000, 3000)], selectedId: 'a' })
    const before = dpiInfo(useFitStore.getState())!.dpi
    useFitStore.getState().setCrop('a', { zoom: 2, cx: 0.5, cy: 0.5 })
    expect(dpiInfo(useFitStore.getState())!.dpi).toBeCloseTo(before / 2, 0)
  })

  it('in contain mode measures the whole photo fitted into the print', () => {
    useFitStore.setState({ images: [img('a', 1500, 1000)], selectedId: 'a', mode: 'contain' })
    // 1500 px на 100 мм ширины (книжный лист 100x150) = 381 dpi
    expect(dpiInfo(useFitStore.getState())?.dpi).toBeCloseTo(381, 0)
  })

  it('is null without a selected photo or with an invalid size', () => {
    expect(dpiInfo(useFitStore.getState())).toBeNull()
    useFitStore.setState({ images: [img('a', 1000, 1500)], selectedId: 'a', formatId: 'custom', custom: null })
    expect(dpiInfo(useFitStore.getState())).toBeNull()
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
