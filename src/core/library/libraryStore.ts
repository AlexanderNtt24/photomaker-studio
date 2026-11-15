import { create } from 'zustand'
import { loadImage, type LoadedImage } from '../image/load'

export type LoadError = { name: string; error: string }

export type LibraryState = {
  images: LoadedImage[]
  selectedId: string | null
  errors: LoadError[]

  addFiles: (files: File[]) => Promise<void>
  select: (id: string) => void
  remove: (id: string) => void
  clearErrors: () => void
  /** Готовые фото (из проекта): добавляются без выбора и без повторов */
  addLoaded: (images: LoadedImage[]) => void
}

const removedListeners = new Set<(id: string) => void>()

/** Подписка на удаление фото: режимы чистят свои данные об удалённом снимке. Возвращает отписку. */
export function onImageRemoved(fn: (id: string) => void): () => void {
  removedListeners.add(fn)
  return () => {
    removedListeners.delete(fn)
  }
}

export function imageById(s: Pick<LibraryState, 'images'>, id: string | null): LoadedImage | undefined {
  return id ? s.images.find((i) => i.id === id) : undefined
}

/** Общая библиотека загруженных фото: её используют и «Подгонка», и «Коллаж». */
export const useLibraryStore = create<LibraryState>((set, get) => ({
  images: [],
  selectedId: null,
  errors: [],

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

  addLoaded: (loaded) =>
    set((s) => {
      const have = new Set(s.images.map((i) => i.id))
      return { images: [...s.images, ...loaded.filter((i) => !have.has(i.id))] }
    }),

  remove(id) {
    const { images, selectedId } = get()
    const idx = images.findIndex((i) => i.id === id)
    if (idx < 0) return
    const rest = images.filter((i) => i.id !== id)
    let next = selectedId
    if (selectedId === id) next = (rest[idx] ?? rest[idx - 1])?.id ?? null
    set({ images: rest, selectedId: next })
    for (const fn of removedListeners) fn(id)
  },

  clearErrors: () => set({ errors: [] }),
}))
