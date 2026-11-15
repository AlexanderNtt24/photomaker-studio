import { create } from 'zustand'
import { loadImage, type LoadedImage } from '../../core/image/load'
import { PRINT_FORMATS, customFormat, orientedSizeMm, parseDecimal, exceedsPixelLimit, type Orientation } from '../../core/formats'
import { effectiveDpi, dpiLevel, type DpiLevel } from '../../core/dpi'
import { cropRect, type CropState } from '../../core/fit/geometry'
import { NO_EFFECTS, type EffectParams } from '../../core/effects/types'
import { parsePresets, serializePresets, type Preset } from '../../core/effects/presets'
import { History } from '../../core/history/history'

export type LoadError = { name: string; error: string }
export type CustomSize = { width: string; height: string; unit: 'mm' | 'cm' }
export type FitMethod = 'crop' | 'contain'

export const DEFAULT_CROP: CropState = { zoom: 1, cx: 0.5, cy: 0.5 }
export const MIN_DPI = 72
export const MAX_DPI = 1200

/** Что откатывает undo/redo. Загрузка и удаление фото, пресеты и dpi в историю не входят. */
type Snapshot = Pick<FitState, 'formatId' | 'orientation' | 'custom' | 'mode' | 'marginColor' | 'cropById' | 'effectsById'>
const snapshotOf = (s: FitState): Snapshot => ({
  formatId: s.formatId,
  orientation: s.orientation,
  custom: s.custom,
  mode: s.mode,
  marginColor: s.marginColor,
  cropById: s.cropById,
  effectsById: s.effectsById,
})
const INITIAL_SNAPSHOT: Snapshot = {
  formatId: '10x15',
  orientation: 'portrait',
  custom: null,
  mode: 'crop',
  marginColor: '#ffffff',
  cropById: {},
  effectsById: {},
}
/** Пауза без изменений, после которой непрерывный жест (перетаскивание, ползунок) считается законченным. */
const GESTURE_IDLE_MS = 400

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
  userPresets: Preset[]

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
  loadUserPresets: () => Promise<void>
  addPreset: (name: string, params: EffectParams) => Preset | null
  deletePreset: (id: string) => void

  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  resetHistory: () => void
}

export const useFitStore = create<FitState>((set, get) => {
  // История создаётся сразу из начальных значений: иначе «исходное» состояние запомнилось бы уже после первой правки.
  let history = new History<Snapshot>(INITIAL_SNAPSHOT)
  let timer: ReturnType<typeof setTimeout> | null = null

  const hist = () => history
  const flags = () => ({ canUndo: hist().canUndo, canRedo: hist().canRedo })

  /** Записывает текущее состояние в историю, если оно отличается от последнего шага. */
  const commit = () => {
    if (timer) clearTimeout(timer)
    timer = null
    const snap = snapshotOf(get())
    if (JSON.stringify(snap) !== JSON.stringify(hist().current)) hist().push(snap)
    set(flags())
  }
  /** Для непрерывных изменений: серия правок склеивается в один шаг истории. */
  const commitLater = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(commit, GESTURE_IDLE_MS)
  }

  return {
    images: [],
    selectedId: null,
    errors: [],

    ...INITIAL_SNAPSHOT,
    dpi: 300,
    userPresets: [],

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

    setFormat(formatId) {
      set({ formatId })
      commit()
    },
    setOrientation(orientation) {
      set({ orientation })
      commit()
    },
    setCustom(custom) {
      set({ custom })
      commitLater()
    },
    setMode(mode) {
      set({ mode })
      commit()
    },
    setDpi(dpi) {
      if (!Number.isFinite(dpi)) return
      set({ dpi: Math.min(MAX_DPI, Math.max(MIN_DPI, Math.round(dpi))) })
    },
    setMarginColor(marginColor) {
      set({ marginColor })
      commitLater()
    },
    setCrop(id, c) {
      set((s) => ({ cropById: { ...s.cropById, [id]: c } }))
      commitLater()
    },
    setEffects(id, e) {
      set((s) => ({ effectsById: { ...s.effectsById, [id]: e } }))
      commitLater()
    },

    async loadUserPresets() {
      const json = await hostApi()?.loadPresets()
      if (json) set({ userPresets: parsePresets(json) })
    },
    addPreset(name, params) {
      const trimmed = name.trim()
      if (!trimmed) return null
      const preset: Preset = { id: crypto.randomUUID(), name: trimmed, params, builtin: false }
      set((s) => ({ userPresets: [...s.userPresets, preset] }))
      persistPresets(get().userPresets)
      return preset
    },
    deletePreset(id) {
      if (!get().userPresets.some((p) => p.id === id)) return
      set((s) => ({ userPresets: s.userPresets.filter((p) => p.id !== id) }))
      persistPresets(get().userPresets)
    },

    canUndo: false,
    canRedo: false,
    undo() {
      commit() // незавершённый жест становится шагом, который можно откатить
      const snap = hist().undo()
      if (snap) set({ ...snap, ...flags() })
    },
    redo() {
      commit()
      const snap = hist().redo()
      if (snap) set({ ...snap, ...flags() })
    },
    resetHistory() {
      if (timer) clearTimeout(timer)
      timer = null
      history = new History(snapshotOf(get()))
      set(flags())
    },
  }
})

function persistPresets(list: Preset[]): void {
  void hostApi()?.savePresets(serializePresets(list))
}

/** window.api есть только внутри Electron; в тестах и в браузере его нет. */
function hostApi() {
  return typeof window === 'undefined' ? undefined : window.api
}

export function effectsFor(s: Pick<FitState, 'effectsById'>, id: string): EffectParams {
  return s.effectsById[id] ?? NO_EFFECTS
}

type Params = Pick<FitState, 'formatId' | 'orientation' | 'custom'>

export function targetSizeMm(s: Params): { widthMm: number; heightMm: number } | null {
  let base: { widthMm: number; heightMm: number } | null | undefined
  if (s.formatId === 'custom') {
    base = s.custom ? customFormat(parseDecimal(s.custom.width), parseDecimal(s.custom.height), s.custom.unit) : null
  } else {
    base = PRINT_FORMATS.find((f) => f.id === s.formatId)
  }
  return base ? orientedSizeMm(base, s.orientation) : null
}

/** Сообщение, если выбранный размер при этом dpi не получится отрисовать (иначе рендерер может упасть). */
export function outputSizeError(s: Pick<FitState, 'formatId' | 'orientation' | 'custom' | 'dpi'>): string | null {
  const size = targetSizeMm(s)
  if (!size || !exceedsPixelLimit(size.widthMm, size.heightMm, s.dpi)) return null
  return 'Слишком большой размер для экспорта: уменьшите размер печати или разрешение (dpi).'
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
