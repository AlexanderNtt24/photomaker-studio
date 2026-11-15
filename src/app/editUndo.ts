import { isEditingTarget } from '../core/hotkeys/layerKeys'

/** Отмена/повтор из меню: в поле ввода — правка самого поля, иначе — история режима. */
export function undoRedo(kind: 'undo' | 'redo', store: () => void): void {
  if (typeof document !== 'undefined' && isEditingTarget(document.activeElement)) document.execCommand(kind)
  else store()
}
