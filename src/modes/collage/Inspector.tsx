import { useEffect, useState } from 'react'
import { useCollageStore } from './collageStore'
import { useLibraryStore } from '../../core/library/libraryStore'
import { EffectsPanel } from '../../ui/EffectsPanel'
import { layerDpi } from '../../core/collage/warnings'
import { dpiLevel } from '../../core/dpi'
import { parseMmField } from './fields'

const DPI_TEXT = {
  ok: null,
  soft: 'Для качественной печати лучше 300 dpi: фото чуть мало для этого размера.',
  strong: 'Мало пикселей для печати в этом размере: изображение будет нечётким.',
} as const

/** Числовое поле в мм: пока человек печатает, держим текст у себя, в модель пишем по Enter/уходу из поля. */
function MmField({ label, value, min, max, onCommit }: { label: string; value: number; min: number; max: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(round(value)))
  useEffect(() => setText(String(round(value))), [value])
  const commit = () => {
    const v = parseMmField(text, min, max)
    if (v === null) setText(String(round(value)))
    else onCommit(v)
  }
  return (
    <label>
      {label}
      <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} />
    </label>
  )
}
const round = (v: number) => Math.round(v * 100) / 100

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label>
      <span className="fx-label">
        {label}
        <span className="hint">{round(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  )
}

export function Inspector() {
  const collage = useCollageStore((s) => s.collage)
  const selectedId = useCollageStore((s) => s.selectedLayerId)
  const { updateLayer, assignImage, bringForward, sendBackward, removeLayer } = useCollageStore.getState()
  const images = useLibraryStore((s) => s.images)
  const layer = collage.layers.find((l) => l.id === selectedId)

  if (!layer || layer.type !== 'photo') {
    return (
      <aside className="fit-controls collage-inspector">
        <p className="hint">
          {layer ? 'Параметры этого слоя появятся в следующих задачах.' : 'Выберите фото на листе, чтобы изменить рамку, тень, поворот и эффекты.'}
        </p>
      </aside>
    )
  }
  const img = images.find((i) => i.id === layer.imageId)
  const dpi = img ? layerDpi(layer, img) : null
  const level = dpi === null ? null : dpiLevel(dpi)
  const cut = collage.sheet.kind === 'cut'

  return (
    <aside className="fit-controls collage-inspector">
      <label>
        Фото
        <select value={layer.imageId ?? ''} onChange={(e) => assignImage(layer.id, e.target.value || null)}>
          <option value="">Пусто</option>
          {images.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
          {layer.imageId && !img && <option value={layer.imageId}>(удалено)</option>}
        </select>
      </label>

      {dpi !== null && level && (
        <div className={'dpi-badge ' + level}>
          <strong>{Math.round(dpi)} dpi</strong> в этом размере
          {DPI_TEXT[level] && <p>{DPI_TEXT[level]}</p>}
        </div>
      )}

      <fieldset className="effects">
        <legend>Рамка</legend>
        <MmField label="Толщина, мм" value={layer.frame.widthMm} min={0} max={50} onCommit={(v) => updateLayer(layer.id, { frame: { ...layer.frame, widthMm: v } })} />
        <label>
          Цвет
          <input type="color" value={layer.frame.color} onChange={(e) => updateLayer(layer.id, { frame: { ...layer.frame, color: e.target.value } })} />
        </label>
        <p className="hint">Рамка входит в размер фото: размер на листе не меняется.</p>
      </fieldset>

      <fieldset className="effects" disabled={cut}>
        <legend>Тень</legend>
        <label className="row">
          <input type="checkbox" checked={layer.shadow.enabled} onChange={(e) => updateLayer(layer.id, { shadow: { ...layer.shadow, enabled: e.target.checked } })} /> Включить
        </label>
        <Slider label="Размытие, мм" value={layer.shadow.blurMm} min={0} max={15} step={0.5} onChange={(v) => updateLayer(layer.id, { shadow: { ...layer.shadow, blurMm: v } })} />
        <Slider label="Смещение, мм" value={layer.shadow.offsetMm} min={0} max={15} step={0.5} onChange={(v) => updateLayer(layer.id, { shadow: { ...layer.shadow, offsetMm: v } })} />
        <Slider label="Прозрачность" value={layer.shadow.opacity} min={0} max={1} step={0.05} onChange={(v) => updateLayer(layer.id, { shadow: { ...layer.shadow, opacity: v } })} />
        {cut && <p className="hint">На листе для вырезания тени не печатаются.</p>}
      </fieldset>

      <Slider label="Скругление, мм" value={layer.cornerRadiusMm} min={0} max={30} step={0.5} onChange={(v) => updateLayer(layer.id, { cornerRadiusMm: v })} />
      <Slider label="Поворот, °" value={layer.rotationDeg} min={-180} max={180} step={1} onChange={(v) => updateLayer(layer.id, { rotationDeg: v })} />

      <fieldset className="effects">
        <legend>Кадрирование</legend>
        <Slider label="Масштаб" value={layer.crop.zoom} min={1} max={8} step={0.01} onChange={(v) => updateLayer(layer.id, { crop: { ...layer.crop, zoom: v } })} />
        <Slider label="Сдвиг по X" value={layer.crop.cx} min={0} max={1} step={0.01} onChange={(v) => updateLayer(layer.id, { crop: { ...layer.crop, cx: v } })} />
        <Slider label="Сдвиг по Y" value={layer.crop.cy} min={0} max={1} step={0.01} onChange={(v) => updateLayer(layer.id, { crop: { ...layer.crop, cy: v } })} />
      </fieldset>

      <div className="fx-actions">
        <button onClick={() => bringForward(layer.id)}>Вперёд</button>
        <button onClick={() => sendBackward(layer.id)}>Назад</button>
        <button onClick={() => removeLayer(layer.id)}>Удалить слой</button>
      </div>

      <EffectsPanel value={layer.effects} onChange={(next) => updateLayer(layer.id, { effects: next })} />
    </aside>
  )
}
