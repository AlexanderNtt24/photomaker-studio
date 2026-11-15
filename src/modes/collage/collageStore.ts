import { create } from 'zustand'
import { History } from '../../core/history/history'
import { clampLayerIntoSheet } from '../../core/collage/geometry'
import { applyTemplate as layoutTemplate, fillIdentical as layoutFill, type Template } from '../../core/collage/layout'
import {
  defaultSheet,
  newPhotoLayer,
  safeRect,
  sheetSizeMm,
  type Background,
  type Collage,
  type PhotoLayer,
  type SheetKind,
} from '../../core/collage/model'
import type { Orientation } from '../../core/formats'
import { onImageRemoved, useLibraryStore } from '../../core/library/libraryStore'

const GESTURE_IDLE_MS = 400
const MIN_LAYER_MM = 10
const MAX_SPACING_MM = 30
const NEW_LAYER_MM = { widthMm: 90, heightMm: 130 }
const CASCADE_MM = 5

type Snapshot = { collage: Collage }

type CollageState = {
  collage: Collage
  selectedLayerId: string | null
  canUndo: boolean
  canRedo: boolean

  setKind: (k: SheetKind) => void
  setOrientation: (o: Orientation) => void
  setSafeMargin: (mm: number) => void
  setGap: (mm: number) => void
  setCropMarks: (on: boolean) => void
  setBackground: (b: Background) => void
  applyTemplate: (id: Template['id']) => void
  fillIdentical: (sizeMm: { widthMm: number; heightMm: number }, count: number | 'max') => void
  addLayer: (imageId: string | null) => void
  removeLayer: (id: string) => void
  assignImage: (layerId: string, imageId: string | null) => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  select: (id: string | null) => void
  updateLayer: (id: string, patch: Partial<PhotoLayer>) => void
  undo: () => void
  redo: () => void
  resetHistory: () => void
}

const INITIAL: Snapshot = { collage: { sheet: defaultSheet(), layers: [] } }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Есть ли в значении нечисла (NaN, ±Infinity) на любой глубине. */
function hasBadNumber(v: unknown): boolean {
  if (typeof v === 'number') return !Number.isFinite(v)
  if (v && typeof v === 'object') return Object.values(v).some(hasBadNumber)
  return false
}

export const useCollageStore = create<CollageState>((set, get) => {
  // История создаётся сразу из начальных значений: иначе «исходное» состояние запомнилось бы уже после первой правки.
  let history = new History<Snapshot>(INITIAL)
  let timer: ReturnType<typeof setTimeout> | null = null
  const flags = () => ({ canUndo: history.canUndo, canRedo: history.canRedo })

  const commit = () => {
    if (timer) clearTimeout(timer)
    timer = null
    const snap: Snapshot = { collage: get().collage }
    if (JSON.stringify(snap) !== JSON.stringify(history.current)) history.push(snap)
    set(flags())
  }
  const commitLater = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(commit, GESTURE_IDLE_MS)
    // Незавершённая правка уже можно отменить (undo сам зафиксирует жест), поэтому кнопка не ждёт паузы.
    set({ canUndo: true })
  }

  // Удалённое из библиотеки фото: рамки остаются, но становятся пустыми (размеры сохраняются).
  onImageRemoved((id) => {
    if (!get().collage.layers.some((l) => l.imageId === id)) return
    setCollage((c) => ({ ...c, layers: c.layers.map((l) => (l.imageId === id ? { ...l, imageId: null } : l)) }))
    commit()
  })

  const setCollage = (fn: (c: Collage) => Collage) => set((s) => ({ collage: fn(s.collage) }))
  const mapLayer = (id: string, fn: (l: PhotoLayer) => PhotoLayer) =>
    setCollage((c) => ({ ...c, layers: c.layers.map((l) => (l.id === id ? fn(l) : l)) }))
  const restore = (snap: Snapshot) =>
    set((s) => ({
      collage: snap.collage,
      selectedLayerId: snap.collage.layers.some((l) => l.id === s.selectedLayerId) ? s.selectedLayerId : null,
      ...flags(),
    }))

  return {
    ...INITIAL,
    selectedLayerId: null,
    canUndo: false,
    canRedo: false,

    setKind(kind) {
      // Слои не меняются: фон, тени и прочее просто не рисуются на листе для вырезания.
      setCollage((c) => ({ ...c, sheet: { ...c.sheet, kind, cropMarks: kind === 'cut' } }))
      commit()
    },
    setOrientation(orientation) {
      setCollage((c) => {
        const sheet = { ...c.sheet, orientation }
        const size = sheetSizeMm(sheet)
        return { sheet, layers: c.layers.map((l) => clampLayerIntoSheet(l, size)) }
      })
      commit()
    },
    setSafeMargin(mm) {
      if (!Number.isFinite(mm)) return
      setCollage((c) => ({ ...c, sheet: { ...c.sheet, safeMarginMm: clamp(mm, 0, MAX_SPACING_MM) } }))
      commitLater()
    },
    setGap(mm) {
      if (!Number.isFinite(mm)) return
      setCollage((c) => ({ ...c, sheet: { ...c.sheet, gapMm: clamp(mm, 0, MAX_SPACING_MM) } }))
      commitLater()
    },
    setCropMarks(cropMarks) {
      setCollage((c) => ({ ...c, sheet: { ...c.sheet, cropMarks } }))
      commit()
    },
    setBackground(background) {
      setCollage((c) => ({ ...c, sheet: { ...c.sheet, background } }))
      commitLater()
    },

    applyTemplate(id) {
      setCollage((c) => ({ ...c, layers: layoutTemplate(c.sheet, id, c.layers) }))
      set({ selectedLayerId: null })
      commit()
    },
    fillIdentical(sizeMm, count) {
      const lib = useLibraryStore.getState()
      const ids = lib.selectedId ? [lib.selectedId] : lib.images.map((i) => i.id)
      setCollage((c) => ({ ...c, layers: layoutFill(c.sheet, sizeMm, ids, count).layers }))
      set({ selectedLayerId: null })
      commit()
    },

    addLayer(imageId) {
      const { collage } = get()
      const safe = safeRect(collage.sheet)
      const n = collage.layers.length
      // Каскад +5 мм; когда доходит до края безопасной зоны — начинаем сначала.
      const room = Math.max(0, Math.min(safe.width - NEW_LAYER_MM.widthMm, safe.height - NEW_LAYER_MM.heightMm))
      const shift = room > 0 ? (n * CASCADE_MM) % (Math.floor(room / CASCADE_MM) * CASCADE_MM + CASCADE_MM) : 0
      const layer = newPhotoLayer({ ...NEW_LAYER_MM, xMm: safe.x + shift, yMm: safe.y + shift, imageId })
      setCollage((c) => ({ ...c, layers: [...c.layers, layer] }))
      set({ selectedLayerId: layer.id })
      commit()
    },
    removeLayer(id) {
      setCollage((c) => ({ ...c, layers: c.layers.filter((l) => l.id !== id) }))
      set((s) => ({ selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId }))
      commit()
    },
    assignImage(layerId, imageId) {
      mapLayer(layerId, (l) => ({ ...l, imageId }))
      commit()
    },
    bringForward(id) {
      setCollage((c) => {
        const i = c.layers.findIndex((l) => l.id === id)
        if (i < 0 || i === c.layers.length - 1) return c
        const layers = [...c.layers]
        ;[layers[i], layers[i + 1]] = [layers[i + 1], layers[i]]
        return { ...c, layers }
      })
      commit()
    },
    sendBackward(id) {
      setCollage((c) => {
        const i = c.layers.findIndex((l) => l.id === id)
        if (i <= 0) return c
        const layers = [...c.layers]
        ;[layers[i], layers[i - 1]] = [layers[i - 1], layers[i]]
        return { ...c, layers }
      })
      commit()
    },
    select(id) {
      set({ selectedLayerId: id })
    },

    updateLayer(id, patch) {
      // Нечисла отбрасываем по ключам: одно неверное поле не должно портить остальные правки.
      const clean: Partial<PhotoLayer> = {}
      for (const [k, v] of Object.entries(patch)) if (!hasBadNumber(v)) (clean as Record<string, unknown>)[k] = v
      if ('widthMm' in clean) clean.widthMm = Math.max(MIN_LAYER_MM, clean.widthMm!)
      if ('heightMm' in clean) clean.heightMm = Math.max(MIN_LAYER_MM, clean.heightMm!)
      if (clean.frame) clean.frame = { ...clean.frame, widthMm: Math.max(0, clean.frame.widthMm) }
      if ('cornerRadiusMm' in clean) clean.cornerRadiusMm = Math.max(0, clean.cornerRadiusMm!)
      if (Object.keys(clean).length === 0) return
      mapLayer(id, (l) => ({ ...l, ...clean }))
      commitLater()
    },

    undo() {
      commit() // незавершённый жест становится шагом, который можно откатить
      const snap = history.undo()
      if (snap) restore(snap)
    },
    redo() {
      commit()
      const snap = history.redo()
      if (snap) restore(snap)
    },
    resetHistory() {
      if (timer) clearTimeout(timer)
      timer = null
      history = new History<Snapshot>({ collage: get().collage })
      set(flags())
    },
  }
})
