import { create } from 'zustand'
import { loadImage, type LoadedImage } from '../../core/image/load'
import { PRINT_FORMATS, customFormat, orientedSizeMm, type Orientation } from '../../core/formats'
import { effectiveDpi, dpiLevel, type DpiLevel } from '../../core/dpi'
import { cropRect, type CropState } from '../../core/fit/geometry'
import { NO_EFFECTS, type EffectParams } from '../../core/effects/types'

export type LoadError = { name: string; error: string }
export type CustomSize = { width: string; height: string; unit: 'mm' | 'cm' }
export type FitMethod = 'crop' | 'contain'

export const DEFAULT_CROP: CropState = { zoom: 1, cx: 0.5, cy: 0.5 }
export const MIN_DPI = 72
export const MAX_DPI = 1200

type FitState = {
  images: LoadedImage[]
  selectedId: string | null
  errors: LoadError[]

  formatId: string
  orientation: Orientation
  custom: CustomSize | null
  mode: FitMethod
  dpi: number
  marginColor: string
  cropById: Record<string, CropState>
  effectsById: Record<string, EffectParams>

  addFiles: (files: File[]) => Promise<void>
  select: (id: string) => void
  remove: (id: string) => void
  clearErrors: () => void

  setFormat: (id: string) => void
  setOrientation: (o: Orientation) => void
  setCustom: (c: CustomSize) => void
  setMode: (m: FitMethod) => void
  setDpi: (dpi: number) => void
  setMarginColor: (c: string) => void
  setCrop: (id: string, c: CropState) => void
  setEffects: (id: string, e: EffectParams) => void
}

export const useFitStore = create<FitState>((set, get) => ({
  images: [],
  selectedId: null,
  errors: [],

  formatId: '10x15',
  orientation: 'portrait',
  custom: null,
  mode: 'crop',
  dpi: 300,
  marginColor: '#ffffff',
  cropById: {},
  effectsById: {},

  // Файлы грузятся по одному: так не раздуваем память на пачке больших фото.
  async addFiles(files) {
    for (const file of files) {
      const r = await loadImage(file)
      if (r.ok) {
        set((s) => ({ images: [...s.images, r.image], selectedId: s.selectedId ?? r.image.id }))
      } else {
        set((s) => ({ errors: [...s.errors, { name: r.name, error: r.error }] }))
      }
    }
  },

  select: (id) => set({ selectedId: id }),

  remove(id) {
    const { images, selectedId } = get()
    const idx = images.findIndex((i) => i.id === id)
    if (idx < 0) return
    const rest = images.filter((i) => i.id !== id)
    let next = selectedId
    if (selectedId === id) next = (rest[idx] ?? rest[idx - 1])?.id ?? null
    set((s) => {
      const { [id]: _c, ...cropById } = s.cropById
      const { [id]: _e, ...effectsById } = s.effectsById
      return { images: rest, selectedId: next, cropById, effectsById }
    })
  },

  clearErrors: () => set({ errors: [] }),

  setFormat: (formatId) => set({ formatId }),
  setOrientation: (orientation) => set({ orientation }),
  setCustom: (custom) => set({ custom }),
  setMode: (mode) => set({ mode }),
  setDpi(dpi) {
    if (!Number.isFinite(dpi)) return
    set({ dpi: Math.min(MAX_DPI, Math.max(MIN_DPI, Math.round(dpi))) })
  },
  setMarginColor: (marginColor) => set({ marginColor }),
  setCrop: (id, c) => set((s) => ({ cropById: { ...s.cropById, [id]: c } })),
  setEffects: (id, e) => set((s) => ({ effectsById: { ...s.effectsById, [id]: e } })),
}))

export function effectsFor(s: Pick<FitState, 'effectsById'>, id: string): EffectParams {
  return s.effectsById[id] ?? NO_EFFECTS
}

type Params = Pick<FitState, 'formatId' | 'orientation' | 'custom'>

export function targetSizeMm(s: Params): { widthMm: number; heightMm: number } | null {
  let base: { widthMm: number; heightMm: number } | null | undefined
  if (s.formatId === 'custom') {
    base = s.custom ? customFormat(parseFloat(s.custom.width), parseFloat(s.custom.height), s.custom.unit) : null
  } else {
    base = PRINT_FORMATS.find((f) => f.id === s.formatId)
  }
  return base ? orientedSizeMm(base, s.orientation) : null
}

export function dpiInfo(s: FitState): { dpi: number; level: DpiLevel } | null {
  const img = s.images.find((i) => i.id === s.selectedId)
  const size = targetSizeMm(s)
  if (!img || !size) return null
  let dpi: number
  if (s.mode === 'crop') {
    const r = cropRect(img.width, img.height, size.widthMm / size.heightMm, s.cropById[img.id] ?? DEFAULT_CROP)
    dpi = Math.min(effectiveDpi(r.width, size.widthMm), effectiveDpi(r.height, size.heightMm))
  } else {
    const mmPerPx = Math.min(size.widthMm / img.width, size.heightMm / img.height)
    dpi = effectiveDpi(img.width, img.width * mmPerPx)
  }
  return { dpi, level: dpiLevel(dpi) }
}
