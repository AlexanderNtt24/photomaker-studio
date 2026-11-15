import { useEffect, useRef, useState } from 'react'
import { useFitStore, targetSizeMm, outputSizeError } from './fitStore'
import { useLibraryStore } from '../../core/library/libraryStore'
import { exportName, uniqueNames } from '../../core/export/filenames'
import { fitParamsFor, formatFileLabel, renderPng } from './exportPng'
import { Thumbs } from './Thumbs'
import { registerCommand } from '../../app/commands'
import { undoRedo } from '../../app/editUndo'
import { CropStage } from './CropStage'
import { Controls } from './Controls'
import './fit.css'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif'

export function FitMode() {
  const { images, selectedId, errors, addFiles, select, remove, clearErrors } = useLibraryStore()
  const { canUndo, canRedo, undo, redo } = useFitStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const canExport =
    images.length > 0 && targetSizeMm(useFitStore.getState()) !== null && outputSizeError(useFitStore.getState()) === null && !busy

  const exportOne = async () => {
    const st = useFitStore.getState()
    const lib = useLibraryStore.getState()
    const img = lib.images.find((i) => i.id === lib.selectedId)
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
    // Сначала папка: если пользователь передумал, мы не тратим минуты на рендер.
    const folder = await window.api?.pickBatchFolder()
    if (!folder) return
    const images = useLibraryStore.getState().images
    setBusy(true)
    const names = uniqueNames(images.map((i) => exportName(i.name, formatFileLabel(st))))
    const failed: string[] = []
    let saved = 0
    // По одному: отрендерил → записал → память освобождена, а не копится на всю пачку.
    for (const [i, img] of images.entries()) {
      setStatus(`Сохраняю ${i + 1} из ${images.length}…`)
      try {
        const p = fitParamsFor(st, img)
        if (!p) throw new Error('неверный размер')
        await window.api?.writeBatchFile(names[i], await renderPng(img, p, st.dpi))
        saved++
      } catch {
        failed.push(img.name)
      }
    }
    setStatus(
      `Сохранено файлов: ${saved} из ${images.length} → ${folder}` + (failed.length ? `. Не удалось: ${failed.join(', ')}` : ''),
    )
    setBusy(false)
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
    const offs = [
      registerCommand('undo', () => undoRedo('undo', () => useFitStore.getState().undo())),
      registerCommand('redo', () => undoRedo('redo', () => useFitStore.getState().redo())),
    ]
    return () => {
      window.removeEventListener('keydown', onKey)
      offs.forEach((off) => off())
    }
  }, [])

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
    </div>
  )
}
