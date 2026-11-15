import { layerKeyAction, isEditingTarget, ownsArrowKeys, type KeyInfo } from '../../core/hotkeys/layerKeys'
import { useCollageStore } from './collageStore'

type KeyEventLike = KeyInfo & { target: EventTarget | null; preventDefault(): void }

/** Клавиши Delete, стрелки и Esc для выбранного слоя. true — клавиша обработана. */
export function handleLayerKey(e: KeyEventLike): boolean {
  const s = useCollageStore.getState()
  const isArrow = e.key.startsWith('Arrow')
  const editing = isArrow ? ownsArrowKeys(e.target) : isEditingTarget(e.target)
  const action = layerKeyAction(e, { editing, hasSelection: s.selectedLayerId !== null })
  if (!action || s.selectedLayerId === null) return false
  e.preventDefault()
  if (action.type === 'delete') s.removeLayer(s.selectedLayerId)
  else if (action.type === 'nudge') s.nudgeLayer(s.selectedLayerId, action.dxMm, action.dyMm)
  else s.select(null)
  return true
}

/** Команды меню «Слой». Не действуют без выбранного слоя и пока фокус в поле ввода. */
export function layerCommands(): Record<'duplicate' | 'forward' | 'backward' | 'delete', () => void> {
  const act = (fn: (id: string) => void) => () => {
    const s = useCollageStore.getState()
    if (s.selectedLayerId === null) return
    if (typeof document !== 'undefined' && isEditingTarget(document.activeElement)) return
    fn(s.selectedLayerId)
  }
  const s = () => useCollageStore.getState()
  return {
    duplicate: act((id) => s().duplicateLayer(id)),
    forward: act((id) => s().bringForward(id)),
    backward: act((id) => s().sendBackward(id)),
    delete: act((id) => s().removeLayer(id)),
  }
}
