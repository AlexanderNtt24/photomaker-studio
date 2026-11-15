import { describe, it, expect } from 'vitest'
import { newPhotoLayer } from '../src/core/collage/model'
import { stageScale, toNode, fromNode } from '../src/modes/collage/stageGeometry'

const L = (xMm: number, yMm: number, widthMm: number, heightMm: number, rotationDeg = 0) =>
  newPhotoLayer({ xMm, yMm, widthMm, heightMm, rotationDeg })
const sheet = { widthMm: 210, heightMm: 297 }

describe('stageScale', () => {
  it('fits the whole sheet with padding', () => {
    expect(stageScale({ width: 800, height: 1000 }, sheet, 0)).toBeCloseTo(Math.min(800 / 210, 1000 / 297))
    expect(stageScale({ width: 800, height: 1000 }, sheet, 20)).toBeCloseTo(Math.min(760 / 210, 960 / 297))
  })
  it('never returns a non-positive scale for a tiny container', () => {
    expect(stageScale({ width: 10, height: 10 }, sheet, 20)).toBeGreaterThan(0)
  })
})

describe('toNode / fromNode', () => {
  it('puts the node origin in the centre of the layer', () => {
    expect(toNode(L(50, 50, 100, 150), 2)).toEqual({ x: 200, y: 250, width: 200, height: 300, offsetX: 100, offsetY: 150, rotation: 0 })
  })
  it('round-trips, including rotation', () => {
    for (const rot of [0, 30, -45]) {
      const l = L(33.3, 41.7, 80, 60, rot)
      const n = toNode(l, 3)
      const back = fromNode({ ...n, scaleX: 1, scaleY: 1 }, 3)
      expect(back.xMm).toBeCloseTo(l.xMm)
      expect(back.yMm).toBeCloseTo(l.yMm)
      expect(back.widthMm).toBeCloseTo(l.widthMm)
      expect(back.heightMm).toBeCloseTo(l.heightMm)
      expect(back.rotationDeg).toBeCloseTo(l.rotationDeg)
    }
  })
  it('a stretched node keeps its centre: scaleX 0.5 at scale 2 gives 50 mm wide, x +25', () => {
    const n = toNode(L(50, 50, 100, 150), 2)
    const back = fromNode({ ...n, scaleX: 0.5, scaleY: 1 }, 2)
    expect(back.widthMm).toBeCloseTo(50)
    expect(back.xMm).toBeCloseTo(75)
    expect(back.heightMm).toBeCloseTo(150)
  })
  it('negative scales (flipped handles) never produce negative sizes', () => {
    const n = toNode(L(50, 50, 100, 150), 2)
    const back = fromNode({ ...n, scaleX: -0.5, scaleY: -1 }, 2)
    expect(back.widthMm).toBeCloseTo(50)
    expect(back.heightMm).toBeCloseTo(150)
  })
})
