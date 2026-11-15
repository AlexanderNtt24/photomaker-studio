import { useEffect } from 'react'
import { CollageStage } from './CollageStage'
import { Inspector } from './Inspector'
import { SheetToolbar } from './SheetToolbar'
import { Thumbs } from '../fit/Thumbs'
import { useCollageStore } from './collageStore'
import { useLibraryStore } from '../../core/library/libraryStore'
import './collage.css'

export function CollageMode() {
  const { images, selectedId, select, remove } = useLibraryStore()

  // Клик по миниатюре: пустой выбранный слой получает фото, иначе фото добавляется новым слоем.
  const pick = (id: string) => {
    select(id)
    const c = useCollageStore.getState()
    const layer = c.collage.layers.find((l) => l.id === c.selectedLayerId)
    if (layer && layer.imageId === null) c.assignImage(layer.id, id)
    else c.addLayer(id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement | null
      // В текстовых полях ⌘Z остаётся за самим полем.
      if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['range', 'checkbox', 'color'].includes(t.type))) return
      e.preventDefault()
      if (e.shiftKey) useCollageStore.getState().redo()
      else useCollageStore.getState().undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="collage">
      <div className="collage-body">
        <SheetToolbar />
        <main className="collage-stage">
          <CollageStage />
        </main>
        <Inspector />
      </div>
      {images.length > 0 && <Thumbs images={images} selectedId={selectedId} onSelect={pick} onRemove={remove} />}
    </div>
  )
}
