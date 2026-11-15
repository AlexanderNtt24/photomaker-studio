import { useEffect, useRef, useState } from 'react'
import { useFitStore } from './fitStore'
import { Thumbs } from './Thumbs'
import { CropStage } from './CropStage'
import { Controls } from './Controls'
import './fit.css'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif'

export function FitMode() {
  const { images, selectedId, errors, addFiles, select, remove, clearErrors } = useFitStore()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
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
