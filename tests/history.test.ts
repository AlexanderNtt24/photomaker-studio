import { describe, it, expect } from 'vitest'
import { History } from '../src/core/history/history'

describe('History', () => {
  it('undoes and redoes in order', () => {
    const h = new History(1)
    h.push(2)
    h.push(3)
    expect(h.undo()).toBe(2)
    expect(h.undo()).toBe(1)
    expect(h.redo()).toBe(2)
    expect(h.current).toBe(2)
  })

  it('push after undo discards the redo branch', () => {
    const h = new History(1)
    h.push(2)
    h.undo()
    h.push(9)
    expect(h.canRedo).toBe(false)
    expect(h.undo()).toBe(1)
  })

  it('returns null when there is nothing to undo or redo', () => {
    const h = new History('a')
    expect(h.undo()).toBeNull()
    expect(h.redo()).toBeNull()
    expect(h.canUndo).toBe(false)
  })

  it('drops the oldest entries beyond the limit', () => {
    const h = new History(0, 3)
    for (let i = 1; i <= 5; i++) h.push(i)
    let steps = 0
    while (h.undo() !== null) steps++
    expect(steps).toBe(2)
    expect(h.current).toBe(3)
  })
})
