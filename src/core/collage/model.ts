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
export type LayerBox = { xMm: number; yMm: number; widthMm: number; heightMm: number; rotationDeg: number }

export type PhotoLayer = LayerBox & {
  id: string
  type: 'photo'
  imageId: string | null
  crop: CropState
  frame: Frame
  shadow: Shadow
  cornerRadiusMm: number
  effects: EffectParams
}

export type TextAlign = 'left' | 'center' | 'right'
export type TextLayer = LayerBox & {
  id: string
  type: 'text'
  text: string
  fontFamily: string
  fontSizePt: number
  color: string
  align: TextAlign
  bold: boolean
  italic: boolean
  opacity: number
}
export type StickerSource = { kind: 'builtin'; id: string } | { kind: 'imported'; id: string }
export type StickerLayer = LayerBox & { id: string; type: 'sticker'; source: StickerSource; opacity: number }

export type Layer = PhotoLayer | TextLayer | StickerLayer
export const isPhoto = (l: Layer): l is PhotoLayer => l.type === 'photo'
export const isText = (l: Layer): l is TextLayer => l.type === 'text'
export const isSticker = (l: Layer): l is StickerLayer => l.type === 'sticker'
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

export function newTextLayer(p: Partial<TextLayer> & Pick<TextLayer, 'xMm' | 'yMm' | 'widthMm' | 'heightMm'>): TextLayer {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    text: 'Подпись',
    fontFamily: 'Bradley Hand',
    fontSizePt: 14,
    color: '#333333',
    align: 'left',
    bold: false,
    italic: false,
    opacity: 1,
    rotationDeg: 0,
    ...p,
  }
}

export function newStickerLayer(
  p: Partial<StickerLayer> & Pick<StickerLayer, 'source' | 'xMm' | 'yMm' | 'widthMm' | 'heightMm'>,
): StickerLayer {
  return { id: crypto.randomUUID(), type: 'sticker', opacity: 1, rotationDeg: 0, ...p }
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
