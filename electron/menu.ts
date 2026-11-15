import type { MenuItemConstructorOptions } from 'electron'
import type { CommandId } from '../src/app/commands'

/** Меню приложения. Данные без зависимости от Electron во время выполнения: так шаблон проверяется тестом. */
export function menuTemplate(send: (id: CommandId) => void, opts: { isMac: boolean; appName: string }): MenuItemConstructorOptions[] {
  const cmd = (label: string, id: CommandId, accelerator?: string, extra: Partial<MenuItemConstructorOptions> = {}): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => send(id),
    ...extra,
  })
  // ⌘Z, ⇧⌘Z, ⌘S, ⇧⌘S, ⌘O ловит и рендерер (с preventDefault вне полей ввода). registerAccelerator:false на macOS не действует
  // (только Windows/Linux), поэтому защита от двойного запуска — preventDefault рендерера: меню получает клавишу, только если страница её не взяла.
  const shown: Partial<MenuItemConstructorOptions> = { registerAccelerator: false }
  const sep: MenuItemConstructorOptions = { type: 'separator' }

  const app: MenuItemConstructorOptions[] = opts.isMac
    ? [{
        label: opts.appName,
        submenu: [
          { role: 'about', label: `О приложении ${opts.appName}` },
          sep,
          { role: 'hide', label: `Скрыть ${opts.appName}` },
          { role: 'hideOthers', label: 'Скрыть остальные' },
          { role: 'unhide', label: 'Показать все' },
          sep,
          { role: 'quit', label: `Завершить ${opts.appName}` },
        ],
      }]
    : []

  return [
    ...app,
    {
      label: 'Файл',
      submenu: [
        cmd('Открыть проект…', 'open', 'CmdOrCtrl+O', shown),
        cmd('Сохранить', 'save', 'CmdOrCtrl+S', shown),
        cmd('Сохранить как…', 'save-as', 'CmdOrCtrl+Shift+S', shown),
        sep,
        cmd('Экспорт PNG…', 'export-png', 'CmdOrCtrl+E'),
        cmd('Экспорт PDF…', 'export-pdf', 'CmdOrCtrl+Shift+E'),
        ...(opts.isMac ? [] : [sep, { role: 'quit', label: 'Выход' } as MenuItemConstructorOptions]),
      ],
    },
    {
      label: 'Правка',
      submenu: [
        cmd('Отменить', 'undo', 'CmdOrCtrl+Z', shown),
        cmd('Повторить', 'redo', 'CmdOrCtrl+Shift+Z', shown),
        sep,
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' },
      ],
    },
    {
      label: 'Слой',
      submenu: [
        cmd('Дублировать', 'duplicate', 'CmdOrCtrl+D'),
        cmd('Поднять выше', 'forward', 'CmdOrCtrl+]'),
        cmd('Опустить ниже', 'backward', 'CmdOrCtrl+['),
        // Без ускорителя: на macOS ускоритель Backspace мог бы перехватывать стирание текста в полях. Клавишу держит рендерер.
        cmd('Удалить  (⌫)', 'delete'),
      ],
    },
    {
      label: 'Вид',
      submenu: [
        cmd('Подгонка', 'mode-fit', 'CmdOrCtrl+1'),
        cmd('Коллаж', 'mode-collage', 'CmdOrCtrl+2'),
        sep,
        { role: 'resetZoom', label: 'Реальный размер' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { role: 'togglefullscreen', label: 'Полный экран' },
      ],
    },
    {
      label: 'Окно',
      submenu: [
        { role: 'minimize', label: 'Свернуть' },
        { role: 'close', label: 'Закрыть окно' },
      ],
    },
  ]
}
