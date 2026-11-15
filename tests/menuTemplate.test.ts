import { describe, it, expect } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { menuTemplate } from '../electron/menu'
import { COMMAND_IDS, type CommandId } from '../src/app/commands'

type Item = MenuItemConstructorOptions
const flat = (items: Item[]): Item[] => items.flatMap((i) => [i, ...(Array.isArray(i.submenu) ? flat(i.submenu) : [])])
const build = (isMac = true) => {
  const sent: CommandId[] = []
  const tpl = menuTemplate((id) => sent.push(id), { isMac, appName: 'PhotoMaker Studio' })
  return { tpl, sent, items: flat(tpl) }
}
const byAccel = (items: Item[], accel: string) => items.find((i) => i.accelerator === accel)

describe('menu template', () => {
  it('every click sends a known command id and every command is in the menu', () => {
    const { items, sent } = build()
    for (const i of items) if (typeof i.click === 'function') (i.click as () => void)()
    expect(sent.every((id) => COMMAND_IDS.includes(id))).toBe(true)
    expect(new Set(sent)).toEqual(new Set(COMMAND_IDS))
  })
  it('items without a role are labelled in Russian', () => {
    const { items } = build()
    for (const i of items) if (!i.role && i.type !== 'separator' && !i.submenu) expect(i.label).toMatch(/[А-Яа-я]/)
  })
  it('shortcuts match the plan', () => {
    const { items } = build()
    const expected: Record<string, CommandId> = {
      'CmdOrCtrl+O': 'open', 'CmdOrCtrl+S': 'save', 'CmdOrCtrl+Shift+S': 'save-as',
      'CmdOrCtrl+E': 'export-png', 'CmdOrCtrl+Shift+E': 'export-pdf',
      'CmdOrCtrl+Z': 'undo', 'CmdOrCtrl+Shift+Z': 'redo',
      'CmdOrCtrl+D': 'duplicate', 'CmdOrCtrl+]': 'forward', 'CmdOrCtrl+[': 'backward',
      'CmdOrCtrl+1': 'mode-fit', 'CmdOrCtrl+2': 'mode-collage',
    }
    for (const [accel, id] of Object.entries(expected)) {
      const item = byAccel(items, accel)
      expect(item, accel).toBeDefined()
      const sent: CommandId[] = []
      const t = menuTemplate((x) => sent.push(x), { isMac: true, appName: 'X' })
      ;(byAccel(flat(t), accel)!.click as () => void)()
      expect(sent).toEqual([id])
    }
  })
  it('shortcuts the renderer already handles are shown only, so one press never runs twice', () => {
    const { items } = build()
    for (const a of ['CmdOrCtrl+O', 'CmdOrCtrl+S', 'CmdOrCtrl+Shift+S', 'CmdOrCtrl+Z', 'CmdOrCtrl+Shift+Z']) expect(byAccel(items, a)!.registerAccelerator, a).toBe(false)
    for (const a of ['CmdOrCtrl+E', 'CmdOrCtrl+D', 'CmdOrCtrl+1']) expect(byAccel(items, a)!.registerAccelerator, a).not.toBe(false)
  })
  it('Delete is shown but not registered, so typing in a field cannot delete a layer', () => {
    const del = build().items.find((i) => i.accelerator === 'Backspace')
    expect(del).toBeDefined()
    expect(del!.registerAccelerator).toBe(false)
  })
  it('Edit menu keeps the clipboard roles', () => {
    const roles = build().items.map((i) => i.role)
    for (const r of ['cut', 'copy', 'paste', 'selectAll']) expect(roles).toContain(r)
  })
  it('on macOS the first menu is the app menu with about, hide and quit', () => {
    const first = build(true).tpl[0]
    const roles = (first.submenu as Item[]).map((i) => i.role)
    expect(roles).toEqual(expect.arrayContaining(['about', 'hide', 'quit']))
    expect(build(false).tpl[0].label).not.toBe('PhotoMaker Studio')
  })
})
