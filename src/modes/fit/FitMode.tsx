import { useEffect, useRef, useState } from 'react'
import { useFitStore, targetSizeMm } from './fitStore'
import { exportName, uniqueNames } from '../../core/export/filenames'
import { fitParamsFor, formatFileLabel, renderPng } from './exportPng'
import { Thumbs } from './Thumbs'
import { CropStage } from './CropStage'
import { Controls } from './Controls'
import './fit.css'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif'

export function FitMode() {
  const { images, selectedId, errors, addFiles, select, remove, clearErrors, canUndo, canRedo, undo, redo } = useFitStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canExport = images.length > 0 && targetSizeMm(useFitStore.getState()) !== null && !busy

  const exportOne = async () => {
    const st = useFitStore.getState()
    const img = st.images.find((i) => i.id === st.selectedId)
    const p = img && fitParamsFor(st, img)
    if (!img || !p) return
    setBusy(true)
    setStatus('Готовлю файл…')
    try {
      const png = await renderPng(img, p, st.dpi)
      const ok = await window.api?.savePng(exportName(img.name, formatFileLabel(st)), png)
      setStatus(ok ? 'Файл сохранён' : null)
    } catch (e) {
      setStatus('Ошибка экспорта: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }

  const exportAll = async () => {
    const st = useFitStore.getState()
    setBusy(true)
    try {
      const files: { name: string; data: Uint8Array }[] = []
      const names = uniqueNames(st.images.map((i) => exportName(i.name, formatFileLabel(st))))
      for (const [i, img] of st.images.entries()) {
        setStatus(`Готовлю ${i + 1} из ${st.images.length}…`)
        const p = fitParamsFor(st, img)
        if (p) files.push({ name: names[i], data: await renderPng(img, p, st.dpi) })
      }
      const r = await window.api?.savePngBatch(files)
      setStatus(r ? `Сохранено файлов: ${r.saved} → ${r.folder}` : null)
    } catch (e) {
      setStatus('Ошибка экспорта: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement | null
      // В текстовых полях ⌘Z остаётся за самим полем.
      if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['range', 'checkbox', 'color'].includes(t.type))) return
      e.preventDefault()
      if (e.shiftKey) useFitStore.getState().redo()
      else useFitStore.getState().undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  return (
    <div className="fit">
      <header className="fit-header">
        <h1>PhotoMaker Studio</h1>
        {status && <span className="hint">{status}</span>}
        <button disabled={!canUndo} onClick={undo} title="Отменить (⌘Z)">
          Отменить
        </button>
        <button disabled={!canRedo} onClick={redo} title="Повторить (⇧⌘Z)">
          Повторить
        </button>
        <button disabled={!canExport} onClick={() => void exportOne()}>
          Экспорт PNG
        </button>
        <button disabled={!canExport || images.length < 2} onClick={() => void exportAll()}>
          Экспорт всех ({images.length})
        </button>
        <button className="primary" onClick={() => inputRef.current?.click()}>
          Выбрать файлы…
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) void addFiles(files)
          }}
        />
      </header>

      {errors.length > 0 && (
        <div className="fit-errors" role="alert">
          <ul>
            {errors.map((er, i) => (
              <li key={i}>
                {er.name}: {er.error}
              </li>
            ))}
          </ul>
          <button onClick={clearErrors}>Закрыть</button>
        </div>
      )}

      <div className="fit-body">
        <main className="fit-stage">
          <CropStage />
        </main>
        <Controls />
      </div>

      {images.length > 0 && <Thumbs images={images} selectedId={selectedId} onSelect={select} onRemove={remove} />}
      {dragging && <div className="fit-drop">Отпустите, чтобы добавить фото</div>}
    </div>
  )
}
