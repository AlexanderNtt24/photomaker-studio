/** Команды приложения: источник — меню главного процесса или клавиши; исполнитель — тот, кто сейчас на экране. */
export const COMMAND_IDS = [
  'open', 'save', 'save-as', 'export-png', 'export-pdf', 'undo', 'redo',
  'duplicate', 'forward', 'backward', 'delete', 'mode-fit', 'mode-collage',
] as const
export type CommandId = (typeof COMMAND_IDS)[number]

const handlers = new Map<string, () => void>()

/** Регистрирует команду; повторная регистрация заменяет прежнюю. Возвращает отписку, которая снимает только свою регистрацию. */
export function registerCommand(id: CommandId, fn: () => void): () => void {
  handlers.set(id, fn)
  return () => {
    if (handlers.get(id) === fn) handlers.delete(id)
  }
}

/** true, если команда есть и выполнилась без исключения. */
export function runCommand(id: string): boolean {
  const fn = handlers.get(id)
  if (!fn) return false
  try {
    fn()
    return true
  } catch (e) {
    console.error(`Команда ${id} не выполнилась:`, e)
    return false
  }
}
