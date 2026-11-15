import { renderCollage, printedLayers, type AssetLookup } from '../../core/render/renderCollage'
import type { CanvasFactory } from '../../core/render/renderFit'
import { isPhoto, sheetSizeMm, type Collage, type SheetKind } from '../../core/collage/model'
import { cropMarkSegments } from '../../core/collage/marks'
import { buildPdf } from '../../core/export/pdf'
import { setPngDpi } from '../../core/export/png'
import { exceedsPixelLimit } from '../../core/formats'
import type { Warning } from '../../core/collage/warnings'

/** Холст и кодирование зависят от среды: в приложении — DOM, в тестах — @napi-rs/canvas. */
export type ExportEnv = {
  create: CanvasFactory
  encode: (canvas: unknown, mime: 'image/png' | 'image/jpeg', quality?: number) => Promise<Uint8Array>
}

export const domEnv: ExportEnv = {
  create: (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  },
  async encode(canvas, mime, quality) {
    const blob = await new Promise<Blob | null>((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, mime, quality))
    if (!blob) throw new Error('Не удалось закодировать изображение')
    return new Uint8Array(await blob.arrayBuffer())
  },
}

export function exportBaseName(kind: SheetKind): string {
  return kind === 'cut' ? 'лист-вырезание' : 'лист-альбом'
}

/** Причина, по которой экспорт невозможен, или null. */
export function canExport(c: Collage): string | null {
  // На листе для вырезания печатаются только фото; на странице альбома хватит и подписи или стикера.
  const hasContent = c.layers.some((l) => (isPhoto(l) ? l.imageId !== null : c.sheet.kind === 'album'))
  if (!hasContent) return 'Добавьте на лист хотя бы одно фото.'
  const { widthMm, heightMm } = sheetSizeMm(c.sheet)
  if (exceedsPixelLimit(widthMm, heightMm, c.sheet.dpi)) return 'Слишком большой размер для экспорта: уменьшите разрешение листа (dpi).'
  return null
}

const full = (c: Collage, drawMarks: boolean) => ({ dpi: c.sheet.dpi, source: 'full' as const, placeholders: false, drawMarks })

export async function renderSheetPng(c: Collage, assets: AssetLookup, env: ExportEnv = domEnv): Promise<Uint8Array> {
  const canvas = renderCollage(c, assets, full(c, c.sheet.cropMarks), env.create)
  return setPngDpi(await env.encode(canvas, 'image/png'), c.sheet.dpi)
}

/** Растр без меток (JPEG 0,95) + метки отдельными векторными линиями: так они остаются тонкими на любом dpi. */
export async function renderSheetPdf(c: Collage, assets: AssetLookup, env: ExportEnv = domEnv): Promise<Uint8Array> {
  const canvas = renderCollage(c, assets, full(c, false), env.create)
  const sheetMm = sheetSizeMm(c.sheet)
  const marks = c.sheet.cropMarks ? cropMarkSegments(printedLayers(c, assets, false), sheetMm) : []
  return buildPdf({ image: await env.encode(canvas, 'image/jpeg', 0.95), imageType: 'jpeg', sheetMm, marks })
}

const KIND_NAME: Record<Warning['kind'], string> = {
  outside: 'Вне поля',
  overlap: 'Пересечение',
  empty: 'Пустая рамка',
  missing: 'Нет фото',
  'low-dpi': 'Низкое разрешение',
  font: 'Шрифт',
}

export function warningText(w: Warning): string {
  return `${KIND_NAME[w.kind]}: ${w.text}`
}
