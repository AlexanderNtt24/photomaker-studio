import { describe, it, expect } from 'vitest'
import { layerKeyAction, isEditingTarget, ownsArrowKeys, type KeyInfo } from '../src/core/hotkeys/layerKeys'

const k = (key: string, extra: Partial<KeyInfo> = {}): KeyInfo => ({ key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...extra })
const sel = { editing: false, hasSelection: true }

describe('layerKeyAction', () => {
  it('Delete and Backspace delete the selected layer', () => {
    expect(layerKeyAction(k('Delete'), sel)).toEqual({ type: 'delete' })
    expect(layerKeyAction(k('Backspace'), sel)).toEqual({ type: 'delete' })
    expect(layerKeyAction(k('Delete'), { editing: false, hasSelection: false })).toBeNull()
  })
  it('arrows nudge by 1 mm, with Shift by 10 mm', () => {
    expect(layerKeyAction(k('ArrowLeft'), sel)).toEqual({ type: 'nudge', dxMm: -1, dyMm: 0 })
    expect(layerKeyAction(k('ArrowRight'), sel)).toEqual({ type: 'nudge', dxMm: 1, dyMm: 0 })
    expect(layerKeyAction(k('ArrowUp'), sel)).toEqual({ type: 'nudge', dxMm: 0, dyMm: -1 })
    expect(layerKeyAction(k('ArrowDown'), sel)).toEqual({ type: 'nudge', dxMm: 0, dyMm: 1 })
    expect(layerKeyAction(k('ArrowRight', { shiftKey: true }), sel)).toEqual({ type: 'nudge', dxMm: 10, dyMm: 0 })
  })
  it('Escape deselects only when something is selected', () => {
    expect(layerKeyAction(k('Escape'), sel)).toEqual({ type: 'deselect' })
    expect(layerKeyAction(k('Escape'), { editing: false, hasSelection: false })).toBeNull()
  })
  it('does nothing while editing', () => {
    for (const key of ['Delete', 'Backspace', 'ArrowLeft', 'Escape']) expect(layerKeyAction(k(key), { editing: true, hasSelection: true })).toBeNull()
  })
  it('ignores combinations with Cmd, Ctrl or Alt and unrelated keys', () => {
    expect(layerKeyAction(k('ArrowLeft', { metaKey: true }), sel)).toBeNull()
    expect(layerKeyAction(k('ArrowLeft', { ctrlKey: true }), sel)).toBeNull()
    expect(layerKeyAction(k('ArrowLeft', { altKey: true }), sel)).toBeNull()
    expect(layerKeyAction(k('Delete', { metaKey: true }), sel)).toBeNull()
    expect(layerKeyAction(k('a'), sel)).toBeNull()
    expect(layerKeyAction(k('Enter'), sel)).toBeNull()
  })
})

const el = (tagName: string, extra: Record<string, unknown> = {}) => ({ tagName, isContentEditable: false, ...extra }) as unknown as EventTarget

describe('isEditingTarget / ownsArrowKeys', () => {
  it('text-like fields are editing targets', () => {
    expect(isEditingTarget(el('TEXTAREA'))).toBe(true)
    expect(isEditingTarget(el('INPUT', { type: 'text' }))).toBe(true)
    expect(isEditingTarget(el('INPUT', { type: 'number' }))).toBe(true)
    expect(isEditingTarget(el('SELECT'))).toBe(true)
    expect(isEditingTarget(el('DIV', { isContentEditable: true }))).toBe(true)
  })
  it('slider, checkbox, colour, button and nothing are not', () => {
    expect(isEditingTarget(el('INPUT', { type: 'range' }))).toBe(false)
    expect(isEditingTarget(el('INPUT', { type: 'checkbox' }))).toBe(false)
    expect(isEditingTarget(el('INPUT', { type: 'color' }))).toBe(false)
    expect(isEditingTarget(el('BUTTON'))).toBe(false)
    expect(isEditingTarget(null)).toBe(false)
  })
  it('a slider owns the arrow keys, a button does not', () => {
    expect(ownsArrowKeys(el('INPUT', { type: 'range' }))).toBe(true)
    expect(ownsArrowKeys(el('INPUT', { type: 'text' }))).toBe(true)
    expect(ownsArrowKeys(el('SELECT'))).toBe(true)
    expect(ownsArrowKeys(el('BUTTON'))).toBe(false)
    expect(ownsArrowKeys(null)).toBe(false)
  })
})
