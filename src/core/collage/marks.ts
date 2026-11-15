import type { PhotoLayer } from './model'

export type Segment = { x1: number; y1: number; x2: number; y2: number }
export type MarkOptions = { offsetMm: number; lengthMm: number; clearanceMm: number }

export const DEFAULT_MARKS: MarkOptions = { offsetMm: 1, lengthMm: 2.5, clearanceMm: 0.3 }
const MIN_LENGTH_MM = 0.8
const EPS = 1e-9

type Vec = { x: number; y: number }

function axes(l: PhotoLayer): { u: Vec; v: Vec; cx: number; cy: number } {
  const a = (l.rotationDeg * Math.PI) / 180
  // Без поворота берём точные 1/0, чтобы метки получались «круглыми» числами.
  const u = l.rotationDeg === 0 ? { x: 1, y: 0 } : { x: Math.cos(a), y: Math.sin(a) }
  const v = { x: -u.y, y: u.x }
  return { u, v, cx: l.xMm + l.widthMm / 2, cy: l.yMm + l.heightMm / 2 }
}

/**
 * Доля отрезка p→p+d (0..1), на которой он входит в слой, расширенный на `clear`;
 * 1, если не входит. Считается в системе координат самого слоя (метод пластин).
 */
function entryFraction(p: Vec, d: Vec, l: PhotoLayer, clear: number): number {
  const { u, v, cx, cy } = axes(l)
  const local = (x: number, y: number): Vec => ({ x: (x - cx) * u.x + (y - cy) * u.y, y: (x - cx) * v.x + (y - cy) * v.y })
  const a = local(p.x, p.y)
  const b = local(p.x + d.x, p.y + d.y)
  const hw = l.widthMm / 2 + clear
  const hh = l.heightMm / 2 + clear
  let t0 = 0
  let t1 = 1
  for (const [s, e, h] of [
    [a.x, b.x, hw],
    [a.y, b.y, hh],
  ] as const) {
    const dir = e - s
    if (Math.abs(dir) < EPS) {
      if (Math.abs(s) >= h) return 1 // параллельно и снаружи пластины
    } else {
      let ta = (-h - s) / dir
      let tb = (h - s) / dir
      if (ta > tb) [ta, tb] = [tb, ta]
      t0 = Math.max(t0, ta)
      t1 = Math.min(t1, tb)
      if (t0 >= t1) return 1
    }
  }
  return t0 // 0, если начало уже внутри
}

/**
 * Метки обрезки: на каждом углу внешнего прямоугольника слоя два коротких отрезка,
 * продолжающих его стороны наружу. Метка обрезается у соседних слоёв, а слишком
 * короткая остаток или уходящая за лист отбрасывается.
 */
export function cropMarkSegments(
  layers: PhotoLayer[],
  sheetMm: { widthMm: number; heightMm: number },
  opts: Partial<MarkOptions> = {},
): Segment[] {
  const o = { ...DEFAULT_MARKS, ...opts }
  const out: Segment[] = []
  layers.forEach((l, li) => {
    const { u, v, cx, cy } = axes(l)
    const hw = l.widthMm / 2
    const hh = l.heightMm / 2
    // Углы по часовой от верхнего левого; для каждого — знаки направлений вдоль u и v.
    const spec: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ]
    for (const [su, sv] of spec) {
      const corner = { x: cx + su * hw * u.x + sv * hh * v.x, y: cy + su * hw * u.y + sv * hh * v.y }
      for (const dir of [
        { x: su * u.x, y: su * u.y },
        { x: sv * v.x, y: sv * v.y },
      ]) {
        const start = { x: corner.x + dir.x * o.offsetMm, y: corner.y + dir.y * o.offsetMm }
        const full = { x: dir.x * o.lengthMm, y: dir.y * o.lengthMm }
        let t = 1
        layers.forEach((other, oi) => {
          if (oi !== li) t = Math.min(t, entryFraction(start, full, other, o.clearanceMm))
        })
        const len = t * o.lengthMm
        if (len < MIN_LENGTH_MM - EPS) continue
        const end = { x: start.x + dir.x * len, y: start.y + dir.y * len }
        const inside = (p: Vec) => p.x >= -EPS && p.y >= -EPS && p.x <= sheetMm.widthMm + EPS && p.y <= sheetMm.heightMm + EPS
        if (!inside(start) || !inside(end)) continue
        out.push({ x1: start.x + 0, y1: start.y + 0, x2: end.x + 0, y2: end.y + 0 })
      }
    }
  })
  return out
}
