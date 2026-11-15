import { mmToPx } from '../formats'
import { cropRect, containRect, type CropState } from '../fit/geometry'
import type { EffectParams } from '../effects/types'

export type FitParams = {
  widthMm: number
  heightMm: number
  mode: 'crop' | 'contain'
  crop: CropState
  marginColor: string
  effects: EffectParams
}

/** Минимум, который нужен рендереру от холста: подходит и HTMLCanvasElement, и OffscreenCanvas. */
export type CanvasLike = {
  width: number
  height: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContext(type: '2d'): any
}
export type CanvasFactory = (w: number, h: number) => CanvasLike
export type RenderSource = CanvasImageSource & { width: number; height: number }

/**
 * Единственная функция, которая рисует результат подгонки: и для предпросмотра
 * (preview + малый dpi), и для экспорта (full + 300 dpi).
 */
export function renderFit(source: RenderSource, p: FitParams, dpi: number, create: CanvasFactory): CanvasLike {
  const w = mmToPx(p.widthMm, dpi)
  const h = mmToPx(p.heightMm, dpi)
  const out = create(w, h)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (p.mode === 'crop') {
    const r = cropRect(source.width, source.height, p.widthMm / p.heightMm, p.crop)
    ctx.drawImage(source, r.x, r.y, r.width, r.height, 0, 0, w, h)
  } else {
    ctx.fillStyle = p.marginColor
    ctx.fillRect(0, 0, w, h)
    const r = containRect(source.width, source.height, w, h)
    ctx.drawImage(source, r.x, r.y, r.width, r.height)
  }
  // Эффекты (p.effects) подключаются в Task 9.
  return out
}
