import { useEffect } from 'react'
import { CollageStage } from './CollageStage'
import { Inspector } from './Inspector'
import { ExportBar } from './ExportBar'
import { SheetToolbar } from './SheetToolbar'
import { Thumbs } from '../fit/Thumbs'
import { useCollageStore } from './collageStore'
import { handleLayerKey, layerCommands } from './layerHotkeys'
import { registerCommand } from '../../app/commands'
import { undoRedo } from '../../app/editUndo'
import { useLibraryStore } from '../../core/library/libraryStore'
import './collage.css'

export function CollageMode() {
  const { images, selectedId, select, remove } = useLibraryStore()

  // Клик по миниатюре: пустой выбранный слой получает фото, иначе фото добавляется новым слоем.
  const pick = (id: string) => {
    select(id)
    const c = useCollageStore.getState()
    const layer = c.collage.layers.find((l) => l.id === c.selectedLayerId)
    if (layer && layer.type === 'photo' && layer.imageId === null) c.assignImage(layer.id, id)
    else c.addLayer(id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (handleLayerKey(e)) return
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      const t = e.target as HTMLElement | null
      // В текстовых полях ⌘Z остаётся за самим полем.
      if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['range', 'checkbox', 'color'].includes(t.type))) return
      e.preventDefault()
      if (e.shiftKey) useCollageStore.getState().redo()
      else useCollageStore.getState().undo()
    }
    window.addEventListener('keydown', onKey)
    const c = layerCommands()
    const offs = [
      registerCommand('duplicate', c.duplicate),
      registerCommand('forward', c.forward),
      registerCommand('backward', c.backward),
      registerCommand('delete', c.delete),
      registerCommand('undo', () => undoRedo('undo', () => useCollageStore.getState().undo())),
      registerCommand('redo', () => undoRedo('redo', () => useCollageStore.getState().redo())),
    ]
    return () => {
      window.removeEventListener('keydown', onKey)
      offs.forEach((off) => off())
    }
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
      <ExportBar />
      {images.length > 0 && <Thumbs images={images} selectedId={selectedId} onSelect={pick} onRemove={remove} />}
    </div>
  )
}
