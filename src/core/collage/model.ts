import { DEFAULT_CROP, type CropState, type Rect } from '../fit/geometry'
import { NO_EFFECTS, type EffectParams } from '../effects/types'
import type { Orientation } from '../formats'

export type SheetKind = 'album' | 'cut'
export type TextureId = 'paper' | 'kraft' | 'chalk'
export type Background =
  | { type: 'color'; color: string }
  | { type: 'gradient'; from: string; to: string; angleDeg: number }
  | { type: 'texture'; id: TextureId }

export type Sheet = {
  kind: SheetKind
  orientation: Orientation
  safeMarginMm: number
  gapMm: number
  background: Background
  cropMarks: boolean
  dpi: number
}

export type Frame = { widthMm: number; color: string }
export type Shadow = { enabled: boolean; blurMm: number; offsetMm: number; opacity: number }

/** xMm, yMm — левый верхний угол неповёрнутого прямоугольника; поворот вокруг центра. */
export type PhotoLayer = {
  id: string
  type: 'photo'
  imageId: string | null
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
  rotationDeg: number
  crop: CropState
  frame: Frame
  shadow: Shadow
  cornerRadiusMm: number
  effects: EffectParams
}

export type Layer = PhotoLayer
export type Collage = { sheet: Sheet; layers: Layer[] }

export const A4_MM = { widthMm: 210, heightMm: 297 }
const MIN_WINDOW_MM = 2

export function defaultSheet(kind: SheetKind = 'album'): Sheet {
  return {
    kind,
    orientation: 'portrait',
    safeMarginMm: 5,
    gapMm: 4,
    background: { type: 'color', color: '#ffffff' },
    cropMarks: kind === 'cut',
    dpi: 300,
  }
}

export function newPhotoLayer(
  p: Partial<PhotoLayer> & Pick<PhotoLayer, 'xMm' | 'yMm' | 'widthMm' | 'heightMm'>,
): PhotoLayer {
  return {
    id: crypto.randomUUID(),
    type: 'photo',
    imageId: null,
    rotationDeg: 0,
    crop: DEFAULT_CROP,
    frame: { widthMm: 0, color: '#ffffff' },
    shadow: { enabled: false, blurMm: 3, offsetMm: 1.5, opacity: 0.35 },
    cornerRadiusMm: 0,
    effects: NO_EFFECTS,
    ...p,
  }
}

export function sheetSizeMm(s: Pick<Sheet, 'orientation'>): { widthMm: number; heightMm: number } {
  return s.orientation === 'portrait'
    ? { ...A4_MM }
    : { widthMm: A4_MM.heightMm, heightMm: A4_MM.widthMm }
}

export function safeRect(s: Sheet): Rect {
  const { widthMm, heightMm } = sheetSizeMm(s)
  const m = s.safeMarginMm
  return { x: m, y: m, width: widthMm - 2 * m, height: heightMm - 2 * m }
}

/** Рамка входит в заявленный размер; ограничена так, чтобы окно фото не исчезало. */
export function effectiveFrameMm(l: PhotoLayer): number {
  const w = l.frame.widthMm
  if (!Number.isFinite(w)) return 0
  const limit = Math.min(l.widthMm, l.heightMm) / 2 - 1
  return Math.max(0, Math.min(w, limit))
}

/** Окно фото в локальных координатах слоя. */
export function photoWindow(l: PhotoLayer): Rect {
  const f = effectiveFrameMm(l)
  return {
    x: f,
    y: f,
    width: Math.max(MIN_WINDOW_MM, l.widthMm - 2 * f),
    height: Math.max(MIN_WINDOW_MM, l.heightMm - 2 * f),
  }
}
