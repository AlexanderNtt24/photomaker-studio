import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useCollageStore } from '../src/modes/collage/collageStore'
import { defaultSheet, newTextLayer } from '../src/core/collage/model'
import { handleLayerKey, layerCommands } from '../src/modes/collage/layerHotkeys'

const st = () => useCollageStore.getState()
const target = (tagName: string, type?: string) => ({ tagName, type, isContentEditable: false }) as unknown as EventTarget
const key = (k: string, extra: Record<string, unknown> = {}, t: EventTarget | null = target('DIV')) => {
  const prevented = { value: false }
  const e = { key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, target: t, preventDefault: () => { prevented.value = true }, ...extra }
  return { e, prevented }
}
const setup = () => {
  const t = newTextLayer({ xMm: 20, yMm: 20, widthMm: 80, heightMm: 20, text: 'a' })
  useCollageStore.setState({ collage: { sheet: defaultSheet(), layers: [t] }, selectedLayerId: t.id })
  st().resetHistory()
  return t
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('handleLayerKey', () => {
  it('Delete removes the selected layer and prevents the default', () => {
    setup()
    const { e, prevented } = key('Delete')
    expect(handleLayerKey(e)).toBe(true)
    expect(st().collage.layers).toHaveLength(0)
    expect(prevented.value).toBe(true)
  })
  it('arrows nudge 1 mm, Shift 10 mm; Escape deselects', () => {
    const t = setup()
    handleLayerKey(key('ArrowRight').e)
    expect(st().collage.layers[0].xMm).toBe(21)
    handleLayerKey(key('ArrowDown', { shiftKey: true }).e)
    expect(st().collage.layers[0].yMm).toBe(30)
    handleLayerKey(key('Escape').e)
    expect(st().selectedLayerId).toBeNull()
    expect(st().collage.layers[0].id).toBe(t.id)
  })
  it('a text field keeps Delete and arrows', () => {
    setup()
    for (const k of ['Delete', 'Backspace', 'ArrowLeft']) {
      const { e, prevented } = key(k, {}, target('INPUT', 'text'))
      expect(handleLayerKey(e)).toBe(false)
      expect(prevented.value).toBe(false)
    }
    expect(st().collage.layers).toHaveLength(1)
    expect(st().collage.layers[0].xMm).toBe(20)
  })
  it('a slider keeps the arrows but not Delete', () => {
    setup()
    expect(handleLayerKey(key('ArrowLeft', {}, target('INPUT', 'range')).e)).toBe(false)
    expect(st().collage.layers[0].xMm).toBe(20)
  })
  it('without a selection nothing happens', () => {
    setup()
    useCollageStore.setState({ selectedLayerId: null })
    expect(handleLayerKey(key('Delete').e)).toBe(false)
    expect(st().collage.layers).toHaveLength(1)
  })
})

describe('layerCommands', () => {
  it('duplicate, forward, backward and delete act on the selected layer', () => {
    const t = setup()
    const c = layerCommands()
    c.duplicate()
    expect(st().collage.layers).toHaveLength(2)
    const copyId = st().selectedLayerId!
    c.backward()
    expect(st().collage.layers[0].id).toBe(copyId)
    c.forward()
    expect(st().collage.layers[1].id).toBe(copyId)
    c.delete()
    expect(st().collage.layers.map((l) => l.id)).toEqual([t.id])
  })
  it('do nothing without a selection', () => {
    setup()
    useCollageStore.setState({ selectedLayerId: null })
    const c = layerCommands()
    for (const fn of Object.values(c)) fn()
    expect(st().collage.layers).toHaveLength(1)
  })
})
