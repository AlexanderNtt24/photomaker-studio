import type { Rect } from '../fit/geometry'
import { newPhotoLayer, safeRect, type PhotoLayer, type Sheet } from './model'

export type Template = { id: '2' | '3' | '4' | '6'; label: string; count: number; cells: Rect[] }

const cell = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height })

/** Клетки — в долях безопасной зоны книжного листа (0..1). */
export const TEMPLATES: Template[] = [
  { id: '2', label: '2 фото', count: 2, cells: [cell(0, 0, 1, 0.5), cell(0, 0.5, 1, 0.5)] },
  { id: '3', label: '3 фото', count: 3, cells: [cell(0, 0, 1, 0.5), cell(0, 0.5, 0.5, 0.5), cell(0.5, 0.5, 0.5, 0.5)] },
  { id: '4', label: '4 фото', count: 4, cells: [cell(0, 0, 0.5, 0.5), cell(0.5, 0, 0.5, 0.5), cell(0, 0.5, 0.5, 0.5), cell(0.5, 0.5, 0.5, 0.5)] },
  {
    id: '6',
    label: '6 фото',
    count: 6,
    cells: [0, 1, 2].flatMap((r) => [cell(0, r / 3, 0.5, 1 / 3), cell(0.5, r / 3, 0.5, 1 / 3)]),
  },
]

const EDGE = 1e-9

export function applyTemplate(sheet: Sheet, templateId: Template['id'], existing: PhotoLayer[]): PhotoLayer[] {
  const t = TEMPLATES.find((x) => x.id === templateId)!
  const safe = safeRect(sheet)
  const landscape = sheet.orientation === 'landscape'
  const half = sheet.gapMm / 2
  return t.cells.map((c0, i) => {
    const c = landscape ? cell(c0.y, c0.x, c0.height, c0.width) : c0
    // Внутренние рёбра отступают на половину зазора, внешние остаются на границе безопасной зоны.
    const left = c.x > EDGE ? half : 0
    const top = c.y > EDGE ? half : 0
    const right = c.x + c.width < 1 - EDGE ? half : 0
    const bottom = c.y + c.height < 1 - EDGE ? half : 0
    const x = safe.x + c.x * safe.width + left
    const y = safe.y + c.y * safe.height + top
    return newPhotoLayer({
      xMm: x,
      yMm: y,
      widthMm: c.width * safe.width - left - right,
      heightMm: c.height * safe.height - top - bottom,
      imageId: existing[i]?.imageId ?? null,
    })
  })
}

type Size = { widthMm: number; heightMm: number }
const FIT_EPS = 1e-9
/** Меньше фото на листе не печатают, а сетка из тысяч ячеек вешает предпросмотр и метки. */
export const MIN_IDENTICAL_MM = 10
const MAX_CELLS = 400

function grid(sheet: Sheet, w: number, h: number): { cells: Rect[]; count: number } {
  const safe = safeRect(sheet)
  const gap = sheet.gapMm
  if (w <= 0 || h <= 0) return { cells: [], count: 0 }
  let cols = Math.floor((safe.width + gap) / (w + gap) + FIT_EPS)
  let rows = Math.floor((safe.height + gap) / (h + gap) + FIT_EPS)
  if (cols < 1 || rows < 1) return { cells: [], count: 0 }
  // Ограничиваем размер сетки до того, как она будет построена.
  cols = Math.min(cols, MAX_CELLS)
  rows = Math.min(rows, Math.floor(MAX_CELLS / cols))
  const totalW = cols * w + (cols - 1) * gap
  const totalH = rows * h + (rows - 1) * gap
  const x0 = safe.x + (safe.width - totalW) / 2
  const y0 = safe.y + (safe.height - totalH) / 2
  const cells: Rect[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) cells.push({ x: x0 + c * (w + gap), y: y0 + r * (h + gap), width: w, height: h })
  return { cells, count: cols * rows }
}

export function packIdentical(sheet: Sheet, size: Size): { cells: Rect[]; rotated: boolean; max: number } {
  const normal = grid(sheet, size.widthMm, size.heightMm)
  const turned = grid(sheet, size.heightMm, size.widthMm)
  const useTurned = turned.count > normal.count
  const best = useTurned ? turned : normal
  return { cells: best.cells, rotated: useTurned && best.count > 0, max: best.count }
}

export function fillIdentical(
  sheet: Sheet,
  size: Size,
  imageIds: string[],
  count: number | 'max',
): { layers: PhotoLayer[]; max: number; placed: number } {
  if (Math.min(size.widthMm, size.heightMm) < MIN_IDENTICAL_MM) return { layers: [], max: 0, placed: 0 }
  const { cells, max } = packIdentical(sheet, size)
  const placed = count === 'max' ? max : Math.max(0, Math.min(Math.floor(count), max))
  const layers = cells.slice(0, placed).map((c, i) =>
    newPhotoLayer({
      xMm: c.x,
      yMm: c.y,
      widthMm: c.width,
      heightMm: c.height,
      imageId: imageIds.length ? imageIds[i % imageIds.length] : null,
    }),
  )
  return { layers, max, placed }
}

export function fitMessage(max: number, requested: number, label: string): string | null {
  if (max === 0) return `Формат ${label} не помещается на лист с такими полями`
  if (requested <= max) return null
  return `На лист помещается не более ${max} снимков ${label} (запрошено ${requested})`
}
