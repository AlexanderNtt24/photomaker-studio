import { create } from 'zustand'
import { parsePresets, serializePresets, type Preset } from './presets'
import type { EffectParams } from './types'

type PresetState = {
  userPresets: Preset[]
  loadUserPresets: () => Promise<void>
  addPreset: (name: string, params: EffectParams) => Preset | null
  deletePreset: (id: string) => void
}

export const usePresetStore = create<PresetState>((set, get) => ({
  userPresets: [],
  async loadUserPresets() {
    const json = await hostApi()?.loadPresets()
    if (json) set({ userPresets: parsePresets(json) })
  },
  addPreset(name, params) {
    const trimmed = name.trim()
    if (!trimmed) return null
    const preset: Preset = { id: crypto.randomUUID(), name: trimmed, params, builtin: false }
    set((s) => ({ userPresets: [...s.userPresets, preset] }))
    persist(get().userPresets)
    return preset
  },
  deletePreset(id) {
    if (!get().userPresets.some((p) => p.id === id)) return
    set((s) => ({ userPresets: s.userPresets.filter((p) => p.id !== id) }))
    persist(get().userPresets)
  },
}))

function persist(list: Preset[]): void {
  void hostApi()?.savePresets(serializePresets(list))
}

/** window.api есть только внутри Electron; в тестах и в браузере его нет. */
function hostApi() {
  return typeof window === 'undefined' ? undefined : window.api
}
