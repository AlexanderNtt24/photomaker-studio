import { useCollageStore } from './collageStore'
import { builtinById } from '../../core/stickers/catalog'
import { useImportedStickers } from '../../core/stickers/imported'
import type { StickerLayer } from '../../core/collage/model'
import { Slider } from './Inspector'

export function StickerInspector({ layer }: { layer: StickerLayer }) {
  const { updateLayer, bringForward, sendBackward, removeLayer } = useCollageStore.getState()
  const importedName = useImportedStickers((s) => (layer.source.kind === 'imported' ? s.byId(layer.source.id)?.name : undefined))
  const name = layer.source.kind === 'builtin' ? (builtinById(layer.source.id)?.label ?? layer.source.id) : importedName
  return (
    <aside className="fit-controls collage-inspector">
      <p className="hint">Стикер: {name ?? 'файл потерян'}</p>
      <Slider label="Прозрачность" value={layer.opacity} min={0} max={1} step={0.05} onChange={(v) => updateLayer(layer.id, { opacity: v })} />
      <Slider label="Поворот, °" value={layer.rotationDeg} min={-180} max={180} step={1} onChange={(v) => updateLayer(layer.id, { rotationDeg: v })} />
      <p className="hint">Размер меняется мышью на листе; угловые маркеры сохраняют пропорции.</p>
      <div className="fx-actions">
        <button onClick={() => bringForward(layer.id)}>Вперёд</button>
        <button onClick={() => sendBackward(layer.id)}>Назад</button>
        <button onClick={() => removeLayer(layer.id)}>Удалить слой</button>
      </div>
    </aside>
  )
}
