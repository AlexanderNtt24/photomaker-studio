import { create } from 'zustand'
import { useCollageStore } from './collageStore'
import type { Collage } from '../../core/collage/model'

type ProjectState = {
  /** Имя открытого или сохранённого файла; null — проект ещё не сохранялся */
  name: string | null
  savedCollage: Collage | null
  markSaved: (name: string | null) => void
  isDirty: () => boolean
  reset: () => void
}

/**
 * Пометка «не сохранено» — сравнение по ссылке: история хранит те же объекты, поэтому
 * откат (undo) к сохранённому состоянию возвращает ту же ссылку и снимает пометку.
 */
export const useProjectStore = create<ProjectState>((set, get) => ({
  name: null,
  savedCollage: null,
  markSaved: (name) => set({ name, savedCollage: useCollageStore.getState().collage }),
  isDirty() {
    const { collage } = useCollageStore.getState()
    const saved = get().savedCollage
    return saved === null ? collage.layers.length > 0 : collage !== saved
  },
  reset: () => set({ name: null, savedCollage: null }),
}))

/** Для интерфейса: перерисовка при любом изменении листа или момента сохранения. */
export function useIsDirty(): boolean {
  const collage = useCollageStore((s) => s.collage)
  const saved = useProjectStore((s) => s.savedCollage)
  return saved === null ? collage.layers.length > 0 : collage !== saved
}
