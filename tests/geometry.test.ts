import { describe, it, expect } from 'vitest'
import { cropRect, containRect } from '../src/core/fit/geometry'

describe('cropRect', () => {
  it('at zoom 1 takes the largest centred frame of the target ratio', () => {
    const r = cropRect(6000, 4000, 2 / 3, { zoom: 1, cx: 0.5, cy: 0.5 })
    expect(r.width).toBeCloseTo(2667, 0)
    expect(r.height).toBe(4000)
    expect(r.x).toBeCloseTo((6000 - 2666.67) / 2, 0)
    expect(r.y).toBe(0)
  })

  it('clamps the frame to the left edge when the centre is at 0', () => {
    const r = cropRect(6000, 4000, 2 / 3, { zoom: 1, cx: 0, cy: 0.5 })
    expect(r.x).toBe(0)
  })

  it('clamps the frame to the right edge when the centre is at 1', () => {
    const r = cropRect(6000, 4000, 2 / 3, { zoom: 1, cx: 1, cy: 0.5 })
    expect(r.x + r.width).toBeCloseTo(6000, 5)
  })

  it('halves the frame at zoom 2 and keeps it inside the image', () => {
    const r = cropRect(6000, 4000, 2 / 3, { zoom: 2, cx: 0.5, cy: 0.5 })
    expect(r.width).toBeCloseTo(1333.3, 0)
    expect(r.height).toBe(2000)
    expect(r.y).toBe(1000)
  })

  it('treats zoom below 1 as 1', () => {
    const a = cropRect(6000, 4000, 2 / 3, { zoom: 0.3, cx: 0.5, cy: 0.5 })
    const b = cropRect(6000, 4000, 2 / 3, { zoom: 1, cx: 0.5, cy: 0.5 })
    expect(a).toEqual(b)
  })

  it('fits the width when the photo is narrower than the frame ratio', () => {
    const r = cropRect(4000, 6000, 1, { zoom: 1, cx: 0.5, cy: 0.5 })
    expect(r.width).toBe(4000)
    expect(r.height).toBe(4000)
    expect(r.y).toBe(1000)
  })
})

describe('containRect', () => {
  it('fits a portrait photo into a square box, centred', () => {
    const r = containRect(4000, 6000, 1000, 1000)
    expect(r.height).toBe(1000)
    expect(r.width).toBeCloseTo(666.67, 1)
    expect(r.x).toBeCloseTo(166.67, 1)
    expect(r.y).toBe(0)
  })
})
