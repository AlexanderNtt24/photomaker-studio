import { renderFit, type CanvasFactory, type FitParams } from '../../core/render/renderFit'
import { effectsFor, targetSizeMm, DEFAULT_CROP, type useFitStore } from './fitStore'
import { PRINT_FORMATS } from '../../core/formats'
import type { LoadedImage } from '../../core/image/load'

type State = ReturnType<typeof useFitStore.getState>

const createDomCanvas: CanvasFactory = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function fitParamsFor(s: State, img: LoadedImage): FitParams | null {
  const size = targetSizeMm(s)
  if (!size) return null
  return {
    ...size,
    mode: s.mode,
    crop: s.cropById[img.id] ?? DEFAULT_CROP,
    marginColor: s.marginColor,
    effects: effectsFor(s, img.id),
  }
}

/** Короткая метка формата для имени файла: `10x15` или `12x18cm`. */
export function formatFileLabel(s: State): string {
  if (s.formatId === 'custom' && s.custom) return `${s.custom.width}x${s.custom.height}${s.custom.unit}`.replace(/\s+/g, '')
  return PRINT_FORMATS.find((f) => f.id === s.formatId)?.id ?? s.formatId
}

/** Полноразмерный рендер (full + выбранный dpi) → PNG. Тот же renderFit, что и в предпросмотре. */
export async function renderPng(img: LoadedImage, p: FitParams, dpi: number): Promise<Uint8Array> {
  const canvas = renderFit(img.full, p, dpi, createDomCanvas) as HTMLCanvasElement
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Не удалось закодировать PNG')
  return new Uint8Array(await blob.arrayBuffer())
}
