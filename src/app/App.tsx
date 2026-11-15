import { useEffect, useState } from 'react'
import { FitMode } from '../modes/fit/FitMode'
import { CollageMode } from '../modes/collage/CollageMode'
import { useLibraryStore } from '../core/library/libraryStore'
import { registerCommand, runCommand } from './commands'
import './theme.css'

type Tab = 'fit' | 'collage'

export function App() {
  const [tab, setTab] = useState<Tab>('fit')
  const [dragging, setDragging] = useState(false)
  const addFiles = useLibraryStore((s) => s.addFiles)

  // Один обработчик перетаскивания на всё приложение: фото общие для обоих режимов.
  useEffect(() => {
    const over = (e: DragEvent) => {
      e.preventDefault()
      setDragging(true)
    }
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false)
    }
    const drop = (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) void addFiles(files)
    }
    window.addEventListener('dragover', over)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragover', over)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [addFiles])

  // Команды меню приложения; режимы переключаются и с клавиатуры (⌘1, ⌘2) через то же меню.
  useEffect(() => {
    const offs = [registerCommand('mode-fit', () => setTab('fit')), registerCommand('mode-collage', () => setTab('collage'))]
    const offMenu = window.api?.onCommand(runCommand)
    return () => {
      offs.forEach((off) => off())
      offMenu?.()
    }
  }, [])

  return (
    <div className="app">
      <nav className="app-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'fit'} onClick={() => setTab('fit')}>
          Подгонка
        </button>
        <button role="tab" aria-selected={tab === 'collage'} onClick={() => setTab('collage')}>
          Коллаж
        </button>
      </nav>
      <div className="app-body">
        {tab === 'fit' ? <FitMode /> : <CollageMode />}
      </div>
      {dragging && <div className="fit-drop">Отпустите, чтобы добавить фото</div>}
    </div>
  )
}
