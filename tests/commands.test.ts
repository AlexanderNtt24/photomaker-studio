import { describe, it, expect, vi } from 'vitest'
import { registerCommand, runCommand, COMMAND_IDS } from '../src/app/commands'

describe('command bus', () => {
  it('runs a registered command and reports it', () => {
    const fn = vi.fn()
    const off = registerCommand('undo', fn)
    expect(runCommand('undo')).toBe(true)
    expect(fn).toHaveBeenCalledTimes(1)
    off()
  })
  it('unknown ids and removed commands report false without throwing', () => {
    expect(runCommand('no-such-command')).toBe(false)
    const off = registerCommand('redo', vi.fn())
    off()
    expect(runCommand('redo')).toBe(false)
  })
  it('re-registering replaces; the old unsubscribe does not remove the new one', () => {
    const a = vi.fn(), b = vi.fn()
    const offA = registerCommand('save', a)
    const offB = registerCommand('save', b)
    offA()
    expect(runCommand('save')).toBe(true)
    expect(b).toHaveBeenCalledTimes(1)
    expect(a).not.toHaveBeenCalled()
    offB()
  })
  it('a throwing command does not break the bus', () => {
    const off = registerCommand('open', () => { throw new Error('boom') })
    expect(runCommand('open')).toBe(false)
    off()
    const ok = vi.fn()
    const off2 = registerCommand('save-as', ok)
    expect(runCommand('save-as')).toBe(true)
    off2()
  })
  it('lists every id the menu may send', () => {
    expect(COMMAND_IDS).toContain('export-pdf')
    expect(new Set(COMMAND_IDS).size).toBe(COMMAND_IDS.length)
  })
})
