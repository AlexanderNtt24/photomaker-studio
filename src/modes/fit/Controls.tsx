import { useEffect, useState } from 'react'
import { PRINT_FORMATS } from '../../core/formats'
import { useFitStore, targetSizeMm, dpiInfo, effectsFor, DEFAULT_CROP, MIN_DPI, MAX_DPI } from './fitStore'
import type { EffectParams } from '../../core/effects/types'

type SliderKey = 'brightness' | 'contrast' | 'saturation' | 'sharpen' | 'blur' | 'vignette' | 'grain'
const SLIDERS: { key: SliderKey; label: string; min: number }[] = [
  { key: 'brightness', label: 'Яркость', min: -100 },
  { key: 'contrast', label: 'Контраст', min: -100 },
  { key: 'saturation', label: 'Насыщенность', min: -100 },
  { key: 'sharpen', label: 'Резкость', min: 0 },
  { key: 'blur', label: 'Размытие', min: 0 },
  { key: 'vignette', label: 'Виньетка', min: 0 },
  { key: 'grain', label: 'Зерно', min: 0 },
]

const DPI_TEXT = {
  ok: null,
  soft: 'Для качественной печати лучше 300 dpi: фото чуть мало для этого размера.',
  strong: 'Мало пикселей для печати в этом размере: изображение будет нечётким.',
} as const

export function Controls() {
  const s = useFitStore()
  const size = targetSizeMm(s)
  const info = dpiInfo(s)
  const img = s.images.find((i) => i.id === s.selectedId)
  const crop = (img && s.cropById[img.id]) || DEFAULT_CROP
  const fx = img ? effectsFor(s, img.id) : null
  const setFx = (patch: Partial<EffectParams>) => img && fx && s.setEffects(img.id, { ...fx, ...patch })
  const custom = s.custom ?? { width: '', height: '', unit: 'cm' as const }

  const [dpiText, setDpiText] = useState(String(s.dpi))
  useEffect(() => setDpiText(String(s.dpi)), [s.dpi])
  const commitDpi = () => s.setDpi(parseInt(dpiText, 10))

  return (
    <aside className="fit-controls">
      <label>
        Формат
        <select value={s.formatId} onChange={(e) => s.setFormat(e.target.value)}>
          {PRINT_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} см
            </option>
          ))}
          <option value="custom">Свой размер…</option>
        </select>
      </label>

      {s.formatId === 'custom' && (
        <div className="custom-size">
          <input
            inputMode="decimal"
            placeholder="Ширина"
            value={custom.width}
            onChange={(e) => s.setCustom({ ...custom, width: e.target.value })}
          />
          <span>×</span>
          <input
            inputMode="decimal"
            placeholder="Высота"
            value={custom.height}
            onChange={(e) => s.setCustom({ ...custom, height: e.target.value })}
          />
          <select value={custom.unit} onChange={(e) => s.setCustom({ ...custom, unit: e.target.value as 'mm' | 'cm' })}>
            <option value="cm">см</option>
            <option value="mm">мм</option>
          </select>
          {!size && <p className="hint danger">Введите размер больше 0 и не более 1000 мм.</p>}
        </div>
      )}

      <div className="seg" role="group" aria-label="Ориентация">
        <button className={s.orientation === 'portrait' ? 'on' : ''} onClick={() => s.setOrientation('portrait')}>
          Книжная
        </button>
        <button className={s.orientation === 'landscape' ? 'on' : ''} onClick={() => s.setOrientation('landscape')}>
          Альбомная
        </button>
      </div>

      <div className="seg" role="group" aria-label="Способ подгонки">
        <button className={s.mode === 'crop' ? 'on' : ''} onClick={() => s.setMode('crop')}>
          Кроп
        </button>
        <button className={s.mode === 'contain' ? 'on' : ''} onClick={() => s.setMode('contain')}>
          Вписать
        </button>
      </div>

      {s.mode === 'crop' && img && (
        <label>
          Масштаб
          <input
            type="range"
            min={1}
            max={8}
            step={0.01}
            value={crop.zoom}
            onChange={(e) => s.setCrop(img.id, { ...crop, zoom: parseFloat(e.target.value) })}
          />
          <span className="hint">Перетащите фото на сцене, колесо мыши — масштаб.</span>
        </label>
      )}

      {s.mode === 'contain' && (
        <label>
          Цвет полей
          <input type="color" value={s.marginColor} onChange={(e) => s.setMarginColor(e.target.value)} />
        </label>
      )}

      <label>
        Разрешение, dpi
        <input
          type="number"
          min={MIN_DPI}
          max={MAX_DPI}
          value={dpiText}
          onChange={(e) => setDpiText(e.target.value)}
          onBlur={commitDpi}
          onKeyDown={(e) => e.key === 'Enter' && commitDpi()}
        />
      </label>

      {info && (
        <div className={'dpi-badge ' + info.level}>
          <strong>{Math.round(info.dpi)} dpi</strong> в этом размере
          {DPI_TEXT[info.level] && <p>{DPI_TEXT[info.level]}</p>}
        </div>
      )}

      {img && fx && (
        <fieldset className="effects">
          <legend>Эффекты</legend>
          <div className="fx-toggles">
            <label className="row">
              <input type="checkbox" checked={fx.grayscale} onChange={(e) => setFx({ grayscale: e.target.checked })} /> Ч/Б
            </label>
            <label className="row">
              <input type="checkbox" checked={fx.sepia} onChange={(e) => setFx({ sepia: e.target.checked })} /> Сепия
            </label>
          </div>
          {SLIDERS.map(({ key, label, min }) => (
            <label key={key}>
              <span className="fx-label">
                {label}
                <span className="hint">{fx[key]}</span>
              </span>
              <input type="range" min={min} max={100} step={1} value={fx[key]} onChange={(e) => setFx({ [key]: parseInt(e.target.value, 10) })} />
            </label>
          ))}
        </fieldset>
      )}
    </aside>
  )
}
