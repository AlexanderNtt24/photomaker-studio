import { create } from 'zustand'
import { loadImage, type LoadedImage } from '../../core/image/load'

export type LoadError = { name: string; error: string }

type FitState = {
  images: LoadedImage[]
  selectedId: string | null
  errors: LoadError[]
  addFiles: (files: File[]) => Promise<void>
  select: (id: string) => void
  remove: (id: string) => void
  clearErrors: () => void
}

export const useFitStore = create<FitState>((set, get) => ({
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

  remove(id) {
    const { images, selectedId } = get()
    const idx = images.findIndex((i) => i.id === id)
    if (idx < 0) return
    const rest = images.filter((i) => i.id !== id)
    let next = selectedId
    if (selectedId === id) next = (rest[idx] ?? rest[idx - 1])?.id ?? null
    set({ images: rest, selectedId: next })
  },

  clearErrors: () => set({ errors: [] }),
}))
