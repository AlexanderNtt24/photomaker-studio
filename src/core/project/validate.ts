import { DEFAULT_CROP } from '../fit/geometry'
import { NO_EFFECTS, type EffectParams } from '../effects/types'
import {
  defaultSheet,
  type Background,
  type Collage,
  type Layer,
  type PhotoLayer,
  type Sheet,
  type StickerLayer,
  type TextLayer,
  type TextureId,
} from '../collage/model'

export const MAX_LAYERS = 500
export const MAX_TEXT_LENGTH = 5000

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const num = (v: unknown, def: number, lo: number, hi: number) => (isNum(v) ? clamp(v, lo, hi) : def)
const str = (v: unknown, def: string, max = 200) => (typeof v === 'string' ? v.slice(0, max) : def)
const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
/** Только #rgb/#rrggbb/#rrggbbaa: в проекте нельзя спрятать произвольную строку CSS. */
const color = (v: unknown, def: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : def)

const TEXTURES: TextureId[] = ['paper', 'kraft', 'chalk']

function validBackground(v: unknown): Background {
  if (isObj(v)) {
    if (v.type === 'color') return { type: 'color', color: color(v.color, '#ffffff') }
    if (v.type === 'gradient') {
      return { type: 'gradient', from: color(v.from, '#ffffff'), to: color(v.to, '#cfd8e3'), angleDeg: num(v.angleDeg, 90, 0, 360) }
    }
    if (v.type === 'texture' && TEXTURES.includes(v.id as TextureId)) return { type: 'texture', id: v.id as TextureId }
  }
  return { type: 'color', color: '#ffffff' }
}

function validSheet(raw: unknown): Sheet {
  const d = defaultSheet()
  if (!isObj(raw)) return d
  const kind = raw.kind === 'cut' ? 'cut' : 'album'
  return {
    kind,
    orientation: raw.orientation === 'landscape' ? 'landscape' : 'portrait',
    safeMarginMm: num(raw.safeMarginMm, d.safeMarginMm, 0, 30),
    gapMm: num(raw.gapMm, d.gapMm, 0, 30),
    background: validBackground(raw.background),
    cropMarks: bool(raw.cropMarks, kind === 'cut'),
    dpi: Math.round(num(raw.dpi, d.dpi, 150, 600)),
  }
}

function validEffects(raw: unknown): EffectParams {
  if (!isObj(raw)) return NO_EFFECTS
  const f = (k: 'brightness' | 'contrast' | 'saturation', lo = -100) => num(raw[k], 0, lo, 100)
  return {
    brightness: f('brightness'),
    contrast: f('contrast'),
    saturation: f('saturation'),
    sharpen: num(raw.sharpen, 0, 0, 100),
    blur: num(raw.blur, 0, 0, 100),
    vignette: num(raw.vignette, 0, 0, 100),
    grain: num(raw.grain, 0, 0, 100),
    grayscale: bool(raw.grayscale, false),
    sepia: bool(raw.sepia, false),
  }
}

/** Геометрия обязательна: без неё слой не восстановить. Возвращает null, если число нечисло. */
function box(raw: Obj, minSize: number) {
  if (![raw.xMm, raw.yMm, raw.widthMm, raw.heightMm, raw.rotationDeg].every(isNum)) return null
  return {
    xMm: clamp(raw.xMm as number, -2000, 2000),
    yMm: clamp(raw.yMm as number, -2000, 2000),
    widthMm: clamp(raw.widthMm as number, minSize, 2000),
    heightMm: clamp(raw.heightMm as number, minSize, 2000),
    rotationDeg: clamp(raw.rotationDeg as number, -3600, 3600),
  }
}

function validLayer(raw: unknown): Layer | { dropped: string } {
  if (!isObj(raw)) return { dropped: 'не слой' }
  const id = str(raw.id, '', 100) || crypto.randomUUID()
  if (raw.type === 'photo') {
    const b = box(raw, 10)
    if (!b) return { dropped: 'фото с неверным положением или размером' }
    const crop = isObj(raw.crop) ? raw.crop : {}
    const frame = isObj(raw.frame) ? raw.frame : {}
    const shadow = isObj(raw.shadow) ? raw.shadow : {}
    const l: PhotoLayer = {
      ...b,
      id,
      type: 'photo',
      imageId: typeof raw.imageId === 'string' ? raw.imageId.slice(0, 100) : null,
      crop: { zoom: num(crop.zoom, DEFAULT_CROP.zoom, 1, 8), cx: num(crop.cx, 0.5, 0, 1), cy: num(crop.cy, 0.5, 0, 1) },
      frame: { widthMm: num(frame.widthMm, 0, 0, 50), color: color(frame.color, '#ffffff') },
      shadow: {
        enabled: bool(shadow.enabled, false),
        blurMm: num(shadow.blurMm, 3, 0, 15),
        offsetMm: num(shadow.offsetMm, 1.5, 0, 15),
        opacity: num(shadow.opacity, 0.35, 0, 1),
      },
      cornerRadiusMm: num(raw.cornerRadiusMm, 0, 0, 30),
      effects: validEffects(raw.effects),
    }
    return l
  }
  if (raw.type === 'text') {
    const b = box(raw, 5)
    if (!b) return { dropped: 'текст с неверным положением или размером' }
    const l: TextLayer = {
      ...b,
      id,
      type: 'text',
      text: str(raw.text, '', MAX_TEXT_LENGTH),
      fontFamily: str(raw.fontFamily, 'Bradley Hand', 100),
      fontSizePt: num(raw.fontSizePt, 14, 4, 200),
      color: color(raw.color, '#333333'),
      align: raw.align === 'center' || raw.align === 'right' ? raw.align : 'left',
      bold: bool(raw.bold, false),
      italic: bool(raw.italic, false),
      opacity: num(raw.opacity, 1, 0, 1),
    }
    return l
  }
  if (raw.type === 'sticker') {
    const b = box(raw, 5)
    const src = raw.source
    if (!b || !isObj(src) || (src.kind !== 'builtin' && src.kind !== 'imported') || typeof src.id !== 'string') {
      return { dropped: 'стикер с неверным положением, размером или источником' }
    }
    const l: StickerLayer = { ...b, id, type: 'sticker', source: { kind: src.kind, id: src.id.slice(0, 100) }, opacity: num(raw.opacity, 1, 0, 1) }
    return l
  }
  return { dropped: `слой неизвестного вида «${String(raw.type).slice(0, 30)}»` }
}

/** Не доверяет ничему из файла: возвращает безопасный коллаж и заметки о том, что пришлось отбросить. */
export function validateCollage(raw: unknown): { collage: Collage; notes: string[] } {
  const notes: string[] = []
  if (!isObj(raw)) return { collage: { sheet: defaultSheet(), layers: [] }, notes: ['Лист в проекте не читается: создан пустой.'] }
  const sheet = validSheet(raw.sheet)
  const list = Array.isArray(raw.layers) ? raw.layers : []
  if (list.length > MAX_LAYERS) notes.push(`Слоёв слишком много: оставлены первые ${MAX_LAYERS}.`)
  const seen = new Set<string>()
  const layers: Layer[] = []
  for (const item of list.slice(0, MAX_LAYERS)) {
    const l = validLayer(item)
    if ('dropped' in l) {
      notes.push(`Пропущен слой: ${l.dropped}.`)
      continue
    }
    layers.push(seen.has(l.id) ? { ...l, id: crypto.randomUUID() } : l)
    seen.add(layers[layers.length - 1].id)
  }
  return { collage: { sheet, layers }, notes }
}
