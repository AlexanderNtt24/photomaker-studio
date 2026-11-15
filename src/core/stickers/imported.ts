import { create } from 'zustand'

export type ImportedSticker = { id: string; name: string; mime: string; data: Uint8Array }

type ImportedState = {
  items: ImportedSticker[]
  add: (s: ImportedSticker) => void
  byId: (id: string) => ImportedSticker | undefined
  clear: () => void
}

/** Стикеры, импортированные пользователем или пришедшие из открытого проекта. */
export const useImportedStickers = create<ImportedState>((set, get) => ({
  items: [],
  add: (s) => set((st) => ({ items: [...st.items.filter((x) => x.id !== s.id), s] })),
  byId: (id) => get().items.find((x) => x.id === id),
  clear: () => set({ items: [] }),
}))
