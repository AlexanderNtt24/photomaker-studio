import { useEffect, useState } from 'react'
import { useCollageStore } from './collageStore'
import { FONT_FAMILIES } from '../../core/collage/fonts'
import type { TextLayer } from '../../core/collage/model'
import { Slider } from './Inspector'

const ALIGNS = [
  ['left', 'Слева'],
  ['center', 'По центру'],
  ['right', 'Справа'],
] as const

export function TextInspector({ layer }: { layer: TextLayer }) {
  const { updateLayer, bringForward, sendBackward, removeLayer } = useCollageStore.getState()
  const [size, setSize] = useState(String(layer.fontSizePt))
  useEffect(() => setSize(String(layer.fontSizePt)), [layer.fontSizePt])
  const commitSize = () => {
    const v = parseFloat(size.replace(',', '.'))
    if (Number.isFinite(v)) updateLayer(layer.id, { fontSizePt: v })
    else setSize(String(layer.fontSizePt))
  }
  const known = (FONT_FAMILIES as readonly string[]).includes(layer.fontFamily)

  return (
    <aside className="fit-controls collage-inspector">
      <label>
        Текст
        <textarea rows={4} value={layer.text} onChange={(e) => updateLayer(layer.id, { text: e.target.value })} />
      </label>
      <label>
        Шрифт
        <select value={layer.fontFamily} onChange={(e) => updateLayer(layer.id, { fontFamily: e.target.value })}>
          {!known && <option value={layer.fontFamily}>{layer.fontFamily}</option>}
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>
              {f}
            </option>
          ))}
        </select>
      </label>
      <label>
        Размер, pt
        <input inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value)} onBlur={commitSize} onKeyDown={(e) => e.key === 'Enter' && commitSize()} />
      </label>
      <label>
        Цвет
        <input type="color" value={layer.color} onChange={(e) => updateLayer(layer.id, { color: e.target.value })} />
      </label>
      <div className="seg" role="group" aria-label="Выравнивание">
        {ALIGNS.map(([a, name]) => (
          <button key={a} className={layer.align === a ? 'on' : ''} onClick={() => updateLayer(layer.id, { align: a })}>
            {name}
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Начертание">
        <button className={layer.bold ? 'on' : ''} onClick={() => updateLayer(layer.id, { bold: !layer.bold })}>
          Жирный
        </button>
        <button className={layer.italic ? 'on' : ''} onClick={() => updateLayer(layer.id, { italic: !layer.italic })}>
          Курсив
        </button>
      </div>
      <Slider label="Прозрачность" value={layer.opacity} min={0} max={1} step={0.05} onChange={(v) => updateLayer(layer.id, { opacity: v })} />
      <Slider label="Поворот, °" value={layer.rotationDeg} min={-180} max={180} step={1} onChange={(v) => updateLayer(layer.id, { rotationDeg: v })} />
      <p className="hint">Размер рамки меняется мышью на листе: текст переносится по её ширине и обрезается по границе.</p>
      <div className="fx-actions">
        <button onClick={() => bringForward(layer.id)}>Вперёд</button>
        <button onClick={() => sendBackward(layer.id)}>Назад</button>
        <button onClick={() => removeLayer(layer.id)}>Удалить слой</button>
      </div>
    </aside>
  )
}
