import { useEffect, useState } from 'react'
import { useProjectStore, useIsDirty } from './projectStore'
import { openProjectFile, saveCurrentProject, type IoResult } from './projectIo'

const APP_TITLE = 'PhotoMaker Studio'

/** Кнопки проекта, горячие клавиши ⌘S / ⇧⌘S / ⌘O, заголовок окна и сигнал о несохранённых изменениях. */
export function ProjectBar() {
  const name = useProjectStore((s) => s.name)
  const dirty = useIsDirty()
  const [message, setMessage] = useState<string | null>(null)
  const [notes, setNotes] = useState<string[]>([])

  const show = (r: IoResult) => {
    if (r.status === 'cancelled') return
    setMessage(r.status === 'saved' ? 'Проект сохранён' : r.status === 'opened' ? 'Проект открыт' : (r.message ?? null))
    setNotes(r.notes ?? [])
  }
  const save = async (saveAs: boolean) => show(await saveCurrentProject(saveAs))
  const open = async () => show(await openProjectFile())

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${name ?? 'Без названия'} — ${APP_TITLE}`
    window.api?.setDirty(dirty)
  }, [name, dirty])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        void save(e.shiftKey)
      } else if (k === 'o') {
        e.preventDefault()
        void open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="project-bar">
      <div className="fx-actions">
        <button onClick={() => void open()} title="Открыть проект (⌘O)">
          Открыть…
        </button>
        <button onClick={() => void save(false)} title="Сохранить (⌘S)">
          Сохранить
        </button>
        <button onClick={() => void save(true)} title="Сохранить как… (⇧⌘S)">
          Как…
        </button>
      </div>
      <p className="hint">
        {name ?? 'Без названия'}
        {dirty ? ' • не сохранено' : ''}
      </p>
      {message && <p className="hint">{message}</p>}
      {notes.length > 0 && (
        <ul className="hint danger project-notes">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
