import { create } from 'zustand'
import { History } from '../../core/history/history'
import { clampLayerIntoSheet } from '../../core/collage/geometry'
import { applyTemplate as layoutTemplate, fillIdentical as layoutFill, type Template } from '../../core/collage/layout'
import {
  defaultSheet,
  newPhotoLayer,
  newStickerLayer,
  newTextLayer,
  safeRect,
  sheetSizeMm,
  type Background,
  type Collage,
  isPhoto,
  type Layer,
  type PhotoLayer,
  type StickerLayer,
  type StickerSource,
  type TextLayer,
  type SheetKind,
} from '../../core/collage/model'
import type { Orientation } from '../../core/formats'
import { onImageRemoved, useLibraryStore } from '../../core/library/libraryStore'

const GESTURE_IDLE_MS = 400
const MIN_DPI = 150
const MAX_DPI = 600
const MIN_LAYER_MM = 10
const DUPLICATE_OFFSET_MM = 5
const MIN_OVERLAY_MM = 5
const MIN_FONT_PT = 4
const MAX_FONT_PT = 200
const MAX_TEXT_LENGTH = 5000
const MAX_SPACING_MM = 30
const NEW_LAYER_MM = { widthMm: 90, heightMm: 130 }
const CASCADE_MM = 5

export type LayerPatch = Partial<
  Omit<PhotoLayer, 'id' | 'type'> & Omit<TextLayer, 'id' | 'type'> & Omit<StickerLayer, 'id' | 'type'>
>

const BOX_KEYS = ['xMm', 'yMm', 'widthMm', 'heightMm', 'rotationDeg']
/** Какие поля можно менять у слоя каждого вида: чужие поля игнорируются. */
const ALLOWED: Record<Layer['type'], Set<string>> = {
  photo: new Set([...BOX_KEYS, 'imageId', 'crop', 'frame', 'shadow', 'cornerRadiusMm', 'effects']),
  text: new Set([...BOX_KEYS, 'text', 'fontFamily', 'fontSizePt', 'color', 'align', 'bold', 'italic', 'opacity']),
  sticker: new Set([...BOX_KEYS, 'source', 'opacity']),
}

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
  setDpi: (dpi: number) => void
  setBackground: (b: Background) => void
  applyTemplate: (id: Template['id']) => void
  fillIdentical: (sizeMm: { widthMm: number; heightMm: number }, count: number | 'max') => void
  addLayer: (imageId: string | null) => void
  addText: () => void
  addSticker: (source: StickerSource, aspect: number) => void
  removeLayer: (id: string) => void
  /** Копия слоя сверху со сдвигом 5 мм; копия выбирается. */
  duplicateLayer: (id: string) => void
  /** Сдвиг слоя на мм; слой остаётся на листе, серия сдвигов — один шаг undo. */
  nudgeLayer: (id: string, dxMm: number, dyMm: number) => void
  assignImage: (layerId: string, imageId: string | null) => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  select: (id: string | null) => void
  updateLayer: (id: string, patch: LayerPatch) => void
  undo: () => void
  redo: () => void
  resetHistory: () => void
  /** Открытие проекта: заменяет коллаж, сбрасывает историю и выбор */
  loadCollage: (c: Collage) => void
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
    if (!get().collage.layers.some((l) => isPhoto(l) && l.imageId === id)) return
    setCollage((c) => ({ ...c, layers: c.layers.map((l) => (isPhoto(l) && l.imageId === id ? { ...l, imageId: null } : l)) }))
    commit()
  })

  const setCollage = (fn: (c: Collage) => Collage) => set((s) => ({ collage: fn(s.collage) }))
  const mapLayer = (id: string, fn: (l: Layer) => Layer) =>
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
    setDpi(dpi) {
      if (!Number.isFinite(dpi)) return
      setCollage((c) => ({ ...c, sheet: { ...c.sheet, dpi: clamp(Math.round(dpi), MIN_DPI, MAX_DPI) } }))
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
      // На пустом листе шаблон берёт фото из библиотеки по порядку; иначе сохраняет уже расставленные.
      const libraryIds = useLibraryStore.getState().images.map((i) => i.id)
      setCollage((c) => {
        const photos = c.layers.filter(isPhoto)
        const source = photos.length ? photos : libraryIds.map((imageId) => newPhotoLayer({ xMm: 0, yMm: 0, widthMm: 1, heightMm: 1, imageId }))
        // Текст и стикеры остаются и лежат поверх новых фото.
        return { ...c, layers: [...layoutTemplate(c.sheet, id, source), ...c.layers.filter((l) => !isPhoto(l))] }
      })
      set({ selectedLayerId: null })
      commit()
    },
    fillIdentical(sizeMm, count) {
      const lib = useLibraryStore.getState()
      const ids = lib.selectedId ? [lib.selectedId] : lib.images.map((i) => i.id)
      setCollage((c) => ({ ...c, layers: [...layoutFill(c.sheet, sizeMm, ids, count).layers, ...c.layers.filter((l) => !isPhoto(l))] }))
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
    addText() {
      const safe = safeRect(get().collage.sheet)
      const widthMm = Math.min(80, safe.width)
      const heightMm = Math.min(20, safe.height)
      const layer = newTextLayer({ widthMm, heightMm, xMm: safe.x + (safe.width - widthMm) / 2, yMm: safe.y + (safe.height - heightMm) / 2 })
      setCollage((c) => ({ ...c, layers: [...c.layers, layer] }))
      set({ selectedLayerId: layer.id })
      commit()
    },
    addSticker(source, aspect) {
      const safe = safeRect(get().collage.sheet)
      const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
      // Ширина 40 мм, но слой не выше безопасной зоны: очень высокий рисунок сужаем по высоте.
      let widthMm = Math.min(40, safe.width)
      let heightMm = widthMm / a
      if (heightMm > safe.height) {
        heightMm = safe.height
        widthMm = heightMm * a
      }
      const layer = newStickerLayer({ source, widthMm, heightMm, xMm: safe.x + (safe.width - widthMm) / 2, yMm: safe.y + (safe.height - heightMm) / 2 })
      setCollage((c) => ({ ...c, layers: [...c.layers, layer] }))
      set({ selectedLayerId: layer.id })
      commit()
    },
    removeLayer(id) {
      setCollage((c) => ({ ...c, layers: c.layers.filter((l) => l.id !== id) }))
      set((s) => ({ selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId }))
      commit()
    },
    duplicateLayer(id) {
      const { collage } = get()
      const src = collage.layers.find((l) => l.id === id)
      if (!src) return
      const copy = clampLayerIntoSheet({ ...structuredClone(src), id: crypto.randomUUID(), xMm: src.xMm + DUPLICATE_OFFSET_MM, yMm: src.yMm + DUPLICATE_OFFSET_MM }, sheetSizeMm(collage.sheet))
      setCollage((c) => ({ ...c, layers: [...c.layers, copy] }))
      set({ selectedLayerId: copy.id })
      commit()
    },
    nudgeLayer(id, dxMm, dyMm) {
      const { collage } = get()
      const l = collage.layers.find((x) => x.id === id)
      if (!l || !Number.isFinite(dxMm) || !Number.isFinite(dyMm)) return
      const moved = clampLayerIntoSheet({ ...l, xMm: l.xMm + dxMm, yMm: l.yMm + dyMm }, sheetSizeMm(collage.sheet))
      if (moved.xMm === l.xMm && moved.yMm === l.yMm) return // упёрлись в край: проект не становится «несохранённым»
      get().updateLayer(id, { xMm: moved.xMm, yMm: moved.yMm })
    },
    assignImage(layerId, imageId) {
      mapLayer(layerId, (l) => (isPhoto(l) ? { ...l, imageId } : l))
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
      const target = get().collage.layers.find((l) => l.id === id)
      if (!target) return
      // Чужие поля игнорируем, нечисла отбрасываем по ключам: одно неверное поле не должно портить остальные правки.
      const clean: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(patch)) if (ALLOWED[target.type].has(k) && !hasBadNumber(v)) clean[k] = v
      const minSize = target.type === 'photo' ? MIN_LAYER_MM : MIN_OVERLAY_MM
      const num = (k: string) => clean[k] as number
      if ('widthMm' in clean) clean.widthMm = Math.max(minSize, num('widthMm'))
      if ('heightMm' in clean) clean.heightMm = Math.max(minSize, num('heightMm'))
      if ('cornerRadiusMm' in clean) clean.cornerRadiusMm = Math.max(0, num('cornerRadiusMm'))
      if ('fontSizePt' in clean) clean.fontSizePt = clamp(num('fontSizePt'), MIN_FONT_PT, MAX_FONT_PT)
      if ('opacity' in clean) clean.opacity = clamp(num('opacity'), 0, 1)
      if (typeof clean.text === 'string') clean.text = clean.text.slice(0, MAX_TEXT_LENGTH)
      if (clean.frame) clean.frame = { ...(clean.frame as object), widthMm: Math.max(0, (clean.frame as { widthMm: number }).widthMm) }
      if (Object.keys(clean).length === 0) return
      mapLayer(id, (l) => ({ ...l, ...clean }) as Layer)
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
    loadCollage(collage) {
      set({ collage, selectedLayerId: null })
      get().resetHistory()
    },
    resetHistory() {
      if (timer) clearTimeout(timer)
      timer = null
      history = new History<Snapshot>({ collage: get().collage })
      set(flags())
    },
  }
})
