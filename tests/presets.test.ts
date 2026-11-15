import { describe, it, expect } from 'vitest'
import { BUILTIN_PRESETS, parsePresets, serializePresets, type Preset } from '../src/core/effects/presets'
import { NO_EFFECTS } from '../src/core/effects/types'

const mine = (name: string, id = 'u-' + name): Preset => ({
  id,
  name,
  builtin: false,
  params: { ...NO_EFFECTS, sepia: true, contrast: 20 },
})

describe('BUILTIN_PRESETS', () => {
  it('has the five built-in presets, all flagged builtin with unique ids', () => {
    expect(BUILTIN_PRESETS.map((p) => p.name)).toEqual(['Ч/Б', 'Сепия', 'Винтаж', 'Яркое', 'Мягкое'])
    expect(BUILTIN_PRESETS.every((p) => p.builtin)).toBe(true)
    expect(new Set(BUILTIN_PRESETS.map((p) => p.id)).size).toBe(5)
  })
})

describe('parsePresets', () => {
  it('returns [] for text that is not JSON', () => {
    expect(parsePresets('не json')).toEqual([])
  })
  it('returns [] when JSON is not an array', () => {
    expect(parsePresets('{"a":1}')).toEqual([])
  })
  it('drops entries without a name', () => {
    const json = JSON.stringify([{ id: 'x', params: NO_EFFECTS }, mine('Ok')])
    expect(parsePresets(json).map((p) => p.name)).toEqual(['Ok'])
  })
  it('drops entries whose params are not an object', () => {
    const json = JSON.stringify([{ id: 'x', name: 'Bad', params: 'nope' }])
    expect(parsePresets(json)).toEqual([])
  })
  it('clamps out-of-range numbers and fills missing fields', () => {
    const json = JSON.stringify([{ id: 'x', name: 'Wild', params: { brightness: 9999, grain: -50 } }])
    const [p] = parsePresets(json)
    expect(p.params.brightness).toBe(100)
    expect(p.params.grain).toBe(0)
    expect(p.params.sepia).toBe(false)
    expect(p.builtin).toBe(false)
  })
})

describe('serializePresets', () => {
  it('does not include built-in presets', () => {
    const list = [...BUILTIN_PRESETS, mine('Моё')]
    expect(parsePresets(serializePresets(list)).map((p) => p.name)).toEqual(['Моё'])
  })
  it('round-trips user presets', () => {
    const list = [mine('A'), mine('B')]
    expect(parsePresets(serializePresets(list))).toEqual(list)
  })
})
