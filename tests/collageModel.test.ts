import { describe, it, expect } from 'vitest'
import { defaultSheet, newPhotoLayer, sheetSizeMm, safeRect, effectiveFrameMm, photoWindow } from '../src/core/collage/model'

const layer = (o: Partial<Parameters<typeof newPhotoLayer>[0]> = {}) =>
  newPhotoLayer({ xMm: 0, yMm: 0, widthMm: 100, heightMm: 150, ...o })

describe('sheet', () => {
  it('A4 portrait is 210x297 and landscape 297x210', () => {
    expect(sheetSizeMm({ orientation: 'portrait' })).toEqual({ widthMm: 210, heightMm: 297 })
    expect(sheetSizeMm({ orientation: 'landscape' })).toEqual({ widthMm: 297, heightMm: 210 })
  })
  it('safeRect with 5 mm margin', () => {
    expect(safeRect(defaultSheet())).toEqual({ x: 5, y: 5, width: 200, height: 287 })
  })
  it('album: white, no marks; cut: marks on', () => {
    expect(defaultSheet('album').cropMarks).toBe(false)
    expect(defaultSheet('album').background).toEqual({ type: 'color', color: '#ffffff' })
    expect(defaultSheet('cut').cropMarks).toBe(true)
    expect(defaultSheet().gapMm).toBe(4)
    expect(defaultSheet().dpi).toBe(300)
  })
})

describe('newPhotoLayer', () => {
  it('has the documented defaults and unique ids', () => {
    const a = layer()
    expect(a.frame).toEqual({ widthMm: 0, color: '#ffffff' })
    expect(a.shadow).toEqual({ enabled: false, blurMm: 3, offsetMm: 1.5, opacity: 0.35 })
    expect(a.rotationDeg).toBe(0)
    expect(a.cornerRadiusMm).toBe(0)
    expect(a.imageId).toBeNull()
    expect(layer().id).not.toBe(a.id)
  })
})

describe('frame inside the photo size', () => {
  it('photoWindow of 100x150 with a 5 mm frame', () => {
    const l = layer({ frame: { widthMm: 5, color: '#fff' } })
    expect(photoWindow(l)).toEqual({ x: 5, y: 5, width: 90, height: 140 })
  })
  it('an 80 mm frame on 100x150 is clamped to 49 mm and the window stays >= 2x2 mm', () => {
    const l = layer({ frame: { widthMm: 80, color: '#fff' } })
    expect(effectiveFrameMm(l)).toBe(49)
    const w = photoWindow(l)
    expect(w.width).toBeGreaterThanOrEqual(2)
    expect(w.height).toBeGreaterThanOrEqual(2)
  })
  it('negative and NaN frames are 0', () => {
    expect(effectiveFrameMm(layer({ frame: { widthMm: -3, color: '#fff' } }))).toBe(0)
    expect(effectiveFrameMm(layer({ frame: { widthMm: NaN, color: '#fff' } }))).toBe(0)
  })
  it('a tiny layer never gets a negative frame limit', () => {
    expect(effectiveFrameMm(layer({ widthMm: 1, heightMm: 1, frame: { widthMm: 5, color: '#fff' } }))).toBe(0)
  })
})
