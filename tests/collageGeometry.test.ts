import { describe, it, expect } from 'vitest'
import { newPhotoLayer, newTextLayer } from '../src/core/collage/model'
import { corners, polygonsIntersect, layerInsideRect, clampLayerIntoSheet } from '../src/core/collage/geometry'

const L = (xMm: number, yMm: number, widthMm: number, heightMm: number, rotationDeg = 0) =>
  newPhotoLayer({ xMm, yMm, widthMm, heightMm, rotationDeg })

describe('corners', () => {
  it('unrotated corners go clockwise from the top-left', () => {
    expect(corners(L(10, 20, 30, 40))).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 },
    ])
  })
  it('a 100x50 layer at (50,50) rotated 90deg spans x 75..125, y 25..125', () => {
    const pts = corners(L(50, 50, 100, 50, 90))
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    expect(Math.min(...xs)).toBeCloseTo(75)
    expect(Math.max(...xs)).toBeCloseTo(125)
    expect(Math.min(...ys)).toBeCloseTo(25)
    expect(Math.max(...ys)).toBeCloseTo(125)
  })
})

describe('polygonsIntersect', () => {
  const sq = (x: number, y: number) => corners(L(x, y, 10, 10))
  it('overlapping squares intersect', () => expect(polygonsIntersect(sq(0, 0), sq(5, 5))).toBe(true))
  it('squares touching by a side do not', () => expect(polygonsIntersect(sq(0, 0), sq(10, 0))).toBe(false))
  it('separated squares do not', () => expect(polygonsIntersect(sq(0, 0), sq(30, 0))).toBe(false))
  it('a 45deg rotated square overlapping another intersects', () => {
    expect(polygonsIntersect(corners(L(0, 0, 10, 10, 45)), sq(8, 3))).toBe(true)
  })
})

describe('layerInsideRect', () => {
  const r = { x: 5, y: 5, width: 200, height: 287 }
  it('inside', () => expect(layerInsideRect(L(5, 5, 100, 150), r)).toBe(true))
  it('sticking out by 1 mm is outside', () => expect(layerInsideRect(L(4, 5, 100, 150), r)).toBe(false))
})

describe('clampLayerIntoSheet', () => {
  const sheet = { widthMm: 210, heightMm: 297 }
  it('x=250 moves to 210 - width', () => {
    expect(clampLayerIntoSheet(L(250, 10, 100, 150), sheet).xMm).toBe(110)
  })
  it('a layer wider than the sheet keeps its size and sticks to x=0', () => {
    const c = clampLayerIntoSheet(L(30, 10, 300, 100), sheet)
    expect(c.widthMm).toBe(300)
    expect(c.xMm).toBe(0)
  })
  it('accounts for rotation', () => {
    const c = clampLayerIntoSheet(L(-50, 10, 100, 50, 90), sheet) // bbox 50 wide, centred on x
    const xs = corners(c).map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(0)
  })
})

describe('geometry works for any layer kind', () => {
  const text = (x: number) => newTextLayer({ xMm: x, yMm: 10, widthMm: 80, heightMm: 20 })
  it('corners and layerInsideRect accept a text layer', () => {
    expect(corners(text(10))[1]).toEqual({ x: 90, y: 10 })
    expect(layerInsideRect(text(4), { x: 5, y: 5, width: 200, height: 287 })).toBe(false)
  })
  it('clampLayerIntoSheet keeps the layer kind and its fields', () => {
    const c = clampLayerIntoSheet(text(250), { widthMm: 210, heightMm: 297 })
    expect(c.type).toBe('text')
    expect(c.text).toBe('Подпись')
    expect(c.xMm).toBe(130)
  })
})
