import { describe, it, expect } from 'vitest'
import { newPhotoLayer, type PhotoLayer } from '../src/core/collage/model'
import { corners } from '../src/core/collage/geometry'
import { cropMarkSegments, type Segment } from '../src/core/collage/marks'

const A4 = { widthMm: 210, heightMm: 297 }
const L = (xMm: number, yMm: number, widthMm: number, heightMm: number, rotationDeg = 0): PhotoLayer =>
  newPhotoLayer({ xMm, yMm, widthMm, heightMm, rotationDeg })

const same = (a: Segment, b: Segment) =>
  (['x1', 'y1', 'x2', 'y2'] as const).every((k) => Math.abs(a[k] - b[k]) < 1e-6)

/** Строго внутри выпуклого многоугольника (по часовой), с допуском. */
function strictlyInside(p: { x: number; y: number }, poly: { x: number; y: number }[], eps = 1e-6): boolean {
  let sign = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)
    if (Math.abs(cross) <= eps) return false
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

function crossesAny(segs: Segment[], layers: PhotoLayer[]): boolean {
  return segs.some((s) =>
    layers.some((l) => {
      const poly = corners(l)
      for (let t = 0; t <= 1; t += 0.01) {
        const p = { x: s.x1 + (s.x2 - s.x1) * t, y: s.y1 + (s.y2 - s.y1) * t }
        if (strictlyInside(p, poly)) return true
      }
      return false
    }),
  )
}

describe('cropMarkSegments', () => {
  it('a lone layer gets 8 marks placed 1 mm off each corner, 2.5 mm long', () => {
    const segs = cropMarkSegments([L(50, 50, 100, 150)], A4)
    expect(segs).toHaveLength(8)
    expect(segs).toContainEqual({ x1: 49, y1: 50, x2: 46.5, y2: 50 })
    expect(segs).toContainEqual({ x1: 50, y1: 49, x2: 50, y2: 46.5 })
    expect(segs).toContainEqual({ x1: 151, y1: 200, x2: 153.5, y2: 200 })
    expect(segs).toContainEqual({ x1: 150, y1: 201, x2: 150, y2: 203.5 })
  })

  const pair = (gap: number) => [L(10, 50, 90, 130), L(100 + gap, 50, 90, 130)]
  const between = (segs: Segment[]) => segs.find((s) => same({ ...s, x2: s.x1, y2: s.y1 }, { x1: 101, y1: 50, x2: 101, y2: 50 }))

  it('a 4 mm gap keeps the whole mark between neighbours', () => {
    const s = between(cropMarkSegments(pair(4), A4))!
    expect(s.x2).toBeCloseTo(103.5)
  })
  it('a 3 mm gap trims the mark at the neighbour (1.7 mm left)', () => {
    const s = between(cropMarkSegments(pair(3), A4))!
    expect(s.x2).toBeCloseTo(102.7)
  })
  it('a 2 mm gap leaves 0.7 mm, which is dropped', () => {
    expect(between(cropMarkSegments(pair(2), A4))).toBeUndefined()
  })

  it('a layer rotated by 90deg gets 8 axis-aligned marks outside its outline', () => {
    const l = L(50, 50, 100, 50, 90)
    const segs = cropMarkSegments([l], A4)
    expect(segs).toHaveLength(8)
    for (const s of segs) expect(Math.abs(s.x1 - s.x2) < 1e-6 || Math.abs(s.y1 - s.y2) < 1e-6).toBe(true)
    expect(crossesAny(segs, [l])).toBe(false)
  })

  it('a mark running off the sheet is dropped', () => {
    const segs = cropMarkSegments([L(0.5, 50, 100, 100)], A4)
    expect(segs.every((s) => Math.min(s.x1, s.x2) >= 0)).toBe(true)
    expect(segs).toHaveLength(6) // у левых углов по одному сегменту уходит за край
  })

  it('no mark crosses any layer in a mixed set', () => {
    const layers = [L(10, 10, 90, 130), L(103, 10, 90, 130), L(10, 143, 90, 130), L(120, 160, 70, 60, 30)]
    expect(crossesAny(cropMarkSegments(layers, A4), layers)).toBe(false)
  })
})
