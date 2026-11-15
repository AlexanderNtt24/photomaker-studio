/** Клавиши работы со слоями, которые держит рендерер (меню их держать не может: в поле ввода они сработали бы при наборе). */
export type LayerKeyAction = { type: 'delete' } | { type: 'nudge'; dxMm: number; dyMm: number } | { type: 'deselect' }
export type KeyInfo = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }
export type KeyContext = { editing: boolean; hasSelection: boolean }

export const NUDGE_MM = 1
export const NUDGE_BIG_MM = 10

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

export function layerKeyAction(e: KeyInfo, ctx: KeyContext): LayerKeyAction | null {
  if (ctx.editing || !ctx.hasSelection) return null
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (e.key === 'Delete' || e.key === 'Backspace') return { type: 'delete' }
  if (e.key === 'Escape') return { type: 'deselect' }
  const dir = ARROWS[e.key]
  if (dir) {
    const step = e.shiftKey ? NUDGE_BIG_MM : NUDGE_MM
    return { type: 'nudge', dxMm: dir[0] * step, dyMm: dir[1] * step }
  }
  return null
}

// Окружения без DOM (тесты) и iframe ломают instanceof, поэтому цели проверяются по полям.
type TargetLike = { tagName?: string; type?: string; isContentEditable?: boolean }
const asTarget = (t: unknown): TargetLike | null => (t && typeof t === 'object' ? (t as TargetLike) : null)
const NON_TEXT_INPUTS = new Set(['range', 'checkbox', 'color', 'radio', 'button', 'submit'])

/** Поле, в котором набирают текст или выбирают значение: клавиши слоёв там не действуют. */
export function isEditingTarget(t: EventTarget | null): boolean {
  const el = asTarget(t)
  if (!el) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  return el.tagName === 'INPUT' && !NON_TEXT_INPUTS.has(el.type ?? 'text')
}

/** Элемент, которому стрелки принадлежат сами: текстовые поля и ползунок. */
export function ownsArrowKeys(t: EventTarget | null): boolean {
  const el = asTarget(t)
  if (!el) return false
  return isEditingTarget(t) || (el.tagName === 'INPUT' && el.type === 'range')
}
