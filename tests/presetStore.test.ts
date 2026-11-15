import { describe, it, expect, beforeEach } from 'vitest'
import { usePresetStore } from '../src/core/effects/presetStore'
import { NO_EFFECTS } from '../src/core/effects/types'

beforeEach(() => usePresetStore.setState({ userPresets: [] }))

describe('user presets', () => {
  it('addPreset stores a trimmed, non-builtin preset', () => {
    const p = usePresetStore.getState().addPreset('  Тёплое  ', { ...NO_EFFECTS, sepia: true })
    expect(p?.name).toBe('Тёплое')
    expect(p?.builtin).toBe(false)
    expect(usePresetStore.getState().userPresets).toHaveLength(1)
  })

  it('addPreset ignores an empty name', () => {
    expect(usePresetStore.getState().addPreset('   ', NO_EFFECTS)).toBeNull()
    expect(usePresetStore.getState().userPresets).toHaveLength(0)
  })

  it('deletePreset removes a user preset', () => {
    const p = usePresetStore.getState().addPreset('X', NO_EFFECTS)!
    usePresetStore.getState().deletePreset(p.id)
    expect(usePresetStore.getState().userPresets).toHaveLength(0)
  })

  it('deletePreset cannot remove a built-in preset', () => {
    usePresetStore.getState().deletePreset('builtin-sepia')
    expect(usePresetStore.getState().userPresets).toHaveLength(0)
  })
})
