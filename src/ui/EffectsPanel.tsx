import { useEffect, useState } from 'react'
import { NO_EFFECTS, type EffectParams } from '../core/effects/types'
import { BUILTIN_PRESETS } from '../core/effects/presets'
import { usePresetStore } from '../core/effects/presetStore'

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

export function EffectsPanel({ value: fx, onChange }: { value: EffectParams; onChange: (next: EffectParams) => void }) {
  const { userPresets, loadUserPresets, addPreset, deletePreset } = usePresetStore()
  const [savingName, setSavingName] = useState<string | null>(null)
  useEffect(() => {
    void loadUserPresets()
  }, [loadUserPresets])
  const allPresets = [...BUILTIN_PRESETS, ...userPresets]
  const matched = allPresets.find((p) => JSON.stringify(p.params) === JSON.stringify(fx))
  const setFx = (patch: Partial<EffectParams>) => onChange({ ...fx, ...patch })
  const commitSave = () => {
    if (savingName !== null && addPreset(savingName, fx)) setSavingName(null)
  }

  return (
    <fieldset className="effects">
      <legend>Эффекты</legend>
      <label>
        Пресет
        <select
          value={matched?.id ?? ''}
          onChange={(e) => {
            const preset = allPresets.find((p) => p.id === e.target.value)
            if (preset) onChange(preset.params)
          }}
        >
          <option value="" disabled>
            — выберите —
          </option>
          {BUILTIN_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          {userPresets.length > 0 && (
            <optgroup label="Мои пресеты">
              {userPresets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <div className="fx-actions">
        <button onClick={() => onChange(NO_EFFECTS)}>Сбросить</button>
        <button onClick={() => setSavingName('')}>Сохранить как пресет…</button>
        {matched && !matched.builtin && <button onClick={() => deletePreset(matched.id)}>Удалить пресет</button>}
      </div>
      {savingName !== null && (
        <div className="fx-save">
          <input
            autoFocus
            placeholder="Название пресета"
            value={savingName}
            onChange={(e) => setSavingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitSave()
              if (e.key === 'Escape') setSavingName(null)
            }}
          />
          <button className="primary" disabled={!savingName.trim()} onClick={commitSave}>
            Сохранить
          </button>
        </div>
      )}
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
  )
}
