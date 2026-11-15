import { cropRect } from '../fit/geometry'
import { effectiveDpi, dpiLevel } from '../dpi'
import type { LoadedImage } from '../image/load'
import { corners, layerInsideRect, polygonsIntersect } from './geometry'
import { isPhoto, photoWindow, safeRect, type Collage, type PhotoLayer } from './model'

export type Warning = {
  layerId: string
  kind: 'outside' | 'overlap' | 'empty' | 'missing' | 'low-dpi'
  level: 'info' | 'warn' | 'error'
  text: string
}

type Dims = Pick<LoadedImage, 'id' | 'width' | 'height'>

/** Эффективный dpi окна фото с учётом кропа: меньшее из значений по сторонам. */
export function layerDpi(l: PhotoLayer, img: { width: number; height: number }): number {
  const win = photoWindow(l)
  const r = cropRect(img.width, img.height, win.width / win.height, l.crop)
  return Math.min(effectiveDpi(r.width, win.width), effectiveDpi(r.height, win.height))
}

export function collageWarnings(c: Collage, images: Dims[]): Warning[] {
  const out: Warning[] = []
  const safe = safeRect(c.sheet)
  const byId = new Map(images.map((i) => [i.id, i]))
  for (const l of c.layers) {
    if (!layerInsideRect(l, safe)) {
      out.push({ layerId: l.id, kind: 'outside', level: 'warn', text: 'Фото выходит за безопасное поле печати: край может не напечататься.' })
    }
    if (!isPhoto(l)) continue
    if (l.imageId === null) {
      out.push({ layerId: l.id, kind: 'empty', level: 'info', text: 'перетащите фото или выберите его в панели.' })
      continue
    }
    const img = byId.get(l.imageId)
    if (!img) {
      out.push({ layerId: l.id, kind: 'missing', level: 'warn', text: 'Фото удалено из библиотеки: выберите другое.' })
      continue
    }
    const dpi = layerDpi(l, img)
    const level = dpiLevel(dpi)
    if (level !== 'ok') {
      out.push({
        layerId: l.id,
        kind: 'low-dpi',
        level: level === 'strong' ? 'error' : 'warn',
        text:
          level === 'strong'
            ? `Мало пикселей для печати (${Math.round(dpi)} dpi): изображение будет нечётким.`
            : `Для качественной печати лучше 300 dpi (сейчас ${Math.round(dpi)}).`,
      })
    }
  }
  // Пересечения важны только на листе для вырезания: на странице альбома фото вправе перекрываться.
  if (c.sheet.kind === 'cut') {
    const photos = c.layers.filter(isPhoto)
    const polys = photos.map(corners)
    const flagged = new Set<string>()
    for (let i = 0; i < polys.length; i++)
      for (let j = i + 1; j < polys.length; j++)
        if (polygonsIntersect(polys[i], polys[j])) {
          flagged.add(photos[i].id)
          flagged.add(photos[j].id)
        }
    for (const id of flagged) {
      out.push({ layerId: id, kind: 'overlap', level: 'warn', text: 'Фото пересекается с другим: при вырезании одно повредит другое.' })
    }
  }
  return out
}
