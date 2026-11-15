import type { Rect } from '../fit/geometry'
import type { LayerBox } from './model'

export type Point = { x: number; y: number }

/** Четыре угла по часовой, начиная с верхнего левого, с учётом поворота вокруг центра. */
export function corners(l: LayerBox): Point[] {
  const cx = l.xMm + l.widthMm / 2
  const cy = l.yMm + l.heightMm / 2
  const a = (l.rotationDeg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  const hw = l.widthMm / 2
  const hh = l.heightMm / 2
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) => {
    // Без поворота возвращаем точные числа, без накопленной ошибки cos/sin.
    if (l.rotationDeg === 0) return { x: cx + dx, y: cy + dy }
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos }
  })
}

function project(poly: Point[], axis: Point): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const p of poly) {
    const v = p.x * axis.x + p.y * axis.y
    if (v < min) min = v
    if (v > max) max = v
  }
  return [min, max]
}

/** Пересечение выпуклых многоугольников по осям разделения. Касание сторон — не пересечение. */
export function polygonsIntersect(a: Point[], b: Point[], epsilon = 1e-6): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const len = Math.hypot(q.x - p.x, q.y - p.y)
      if (len === 0) continue
      const axis = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len }
      const [minA, maxA] = project(a, axis)
      const [minB, maxB] = project(b, axis)
      if (maxA <= minB + epsilon || maxB <= minA + epsilon) return false
    }
  }
  return true
}

function bbox(pts: Point[]): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

const EPS = 1e-6

export function layerInsideRect(l: LayerBox, r: Rect): boolean {
  const b = bbox(corners(l))
  return b.minX >= r.x - EPS && b.minY >= r.y - EPS && b.maxX <= r.x + r.width + EPS && b.maxY <= r.y + r.height + EPS
}

/** Сдвигает слой так, чтобы габарит повёрнутого прямоугольника лежал в листе; если не влезает — прижимает к 0. */
export function clampLayerIntoSheet<T extends LayerBox>(l: T, sheet: { widthMm: number; heightMm: number }): T {
  const b = bbox(corners(l))
  const shift = (min: number, max: number, size: number): number => {
    if (max - min >= size) return -min // шире листа: прижать к началу
    if (min < 0) return -min
    if (max > size) return size - max
    return 0
  }
  const dx = shift(b.minX, b.maxX, sheet.widthMm)
  const dy = shift(b.minY, b.maxY, sheet.heightMm)
  return dx === 0 && dy === 0 ? l : { ...l, xMm: l.xMm + dx, yMm: l.yMm + dy }
}
