import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useFitStore } from '../src/modes/fit/fitStore'
import { NO_EFFECTS } from '../src/core/effects/types'

beforeEach(() => {
  vi.useFakeTimers()
  useFitStore.setState({
    formatId: '10x15',
    orientation: 'portrait',
    custom: null,
    mode: 'crop',
    marginColor: '#ffffff',
    cropById: {},
    effectsById: {},
  })
  useFitStore.getState().resetHistory()
})
afterEach(() => vi.useRealTimers())

describe('fitStore history', () => {
  it('undo and redo a format change', () => {
    const s = useFitStore.getState()
    s.setFormat('13x18')
    expect(useFitStore.getState().canUndo).toBe(true)
    useFitStore.getState().undo()
    expect(useFitStore.getState().formatId).toBe('10x15')
    expect(useFitStore.getState().canRedo).toBe(true)
    useFitStore.getState().redo()
    expect(useFitStore.getState().formatId).toBe('13x18')
  })

  it('coalesces a drag into one history step', () => {
    for (let i = 1; i <= 20; i++) useFitStore.getState().setCrop('a', { zoom: 1, cx: 0.5 + i / 100, cy: 0.5 })
    vi.advanceTimersByTime(1000)
    useFitStore.getState().undo()
    expect(useFitStore.getState().cropById['a']).toBeUndefined()
    expect(useFitStore.getState().canUndo).toBe(false)
  })

  it('undo right after a change, before the idle timer fires, still undoes it', () => {
    useFitStore.getState().setEffects('a', { ...NO_EFFECTS, sepia: true })
    useFitStore.getState().undo()
    expect(useFitStore.getState().effectsById['a']).toBeUndefined()
  })

  it('restores effects and mode together with the format', () => {
    useFitStore.getState().setMode('contain')
    useFitStore.getState().setOrientation('landscape')
    useFitStore.getState().undo()
    expect(useFitStore.getState().orientation).toBe('portrait')
    expect(useFitStore.getState().mode).toBe('contain')
    useFitStore.getState().undo()
    expect(useFitStore.getState().mode).toBe('crop')
  })

  it('does not create a step when nothing changed', () => {
    useFitStore.getState().setFormat('10x15')
    expect(useFitStore.getState().canUndo).toBe(false)
  })
})

describe('fitStore history on a fresh store (no manual reset)', () => {
  it('the very first change can be undone back to the defaults', async () => {
    vi.resetModules()
    const { useFitStore: fresh } = await import('../src/modes/fit/fitStore')
    fresh.getState().setOrientation('landscape')
    expect(fresh.getState().canUndo).toBe(true)
    fresh.getState().undo()
    expect(fresh.getState().orientation).toBe('portrait')
  })
})
