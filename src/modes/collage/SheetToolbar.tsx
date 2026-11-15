import { useRef, useState } from 'react'
import { useCollageStore } from './collageStore'
import { useLibraryStore } from '../../core/library/libraryStore'
import { TEMPLATES, packIdentical, fitMessage } from '../../core/collage/layout'
import { PRINT_FORMATS, customFormat, parseDecimal } from '../../core/formats'
import { TEXTURES } from '../../core/render/background'
import type { Background, TextureId } from '../../core/collage/model'
import { parseMmField } from './fields'

const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif'

function SpacingField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null)
  const commit = () => {
    const v = text === null ? null : parseMmField(text, 0, 30)
    if (v !== null) onCommit(v)
    setText(null)
  }
  return (
    <label>
      {label}
      <input
        inputMode="decimal"
        value={text ?? String(value)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </label>
  )
}

function IdenticalBlock() {
  const sheet = useCollageStore((s) => s.collage.sheet)
  const fillIdentical = useCollageStore((s) => s.fillIdentical)
  const [formatId, setFormatId] = useState('9x13')
  const [custom, setCustom] = useState({ width: '', height: '', unit: 'cm' as 'cm' | 'mm' })
  const [countText, setCountText] = useState('4')
  const [useMax, setUseMax] = useState(false)

  const preset = PRINT_FORMATS.find((f) => f.id === formatId)
  const fmt = formatId === 'custom' ? customFormat(parseDecimal(custom.width), parseDecimal(custom.height), custom.unit) : preset
  const size = fmt ? { widthMm: Math.min(fmt.widthMm, fmt.heightMm), heightMm: Math.max(fmt.widthMm, fmt.heightMm) } : null
  const label = formatId === 'custom' ? `${custom.width}×${custom.height} ${custom.unit}` : (preset?.label ?? '')
  const requested = useMax ? Infinity : parseInt(countText, 10)
  const countOk = useMax || (Number.isFinite(requested) && requested >= 1)
  const max = size ? packIdentical(sheet, size).max : 0
  const msg = size && countOk ? fitMessage(max, useMax ? max : requested, label) : null

  return (
    <fieldset className="effects">
      <legend>Одинаковые снимки</legend>
      <label>
        Формат
        <select value={formatId} onChange={(e) => setFormatId(e.target.value)}>
          {PRINT_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label} см
            </option>
          ))}
          <option value="custom">Свой размер…</option>
        </select>
      </label>
      {formatId === 'custom' && (
        <div className="custom-size">
          <input inputMode="decimal" placeholder="Ширина" value={custom.width} onChange={(e) => setCustom({ ...custom, width: e.target.value })} />
          <span>×</span>
          <input inputMode="decimal" placeholder="Высота" value={custom.height} onChange={(e) => setCustom({ ...custom, height: e.target.value })} />
          <select value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value as 'cm' | 'mm' })}>
            <option value="cm">см</option>
            <option value="mm">мм</option>
          </select>
          {!size && <p className="hint danger">Введите размер больше 0 и не более 1000 мм.</p>}
        </div>
      )}
      <label>
        Количество
        <input type="number" min={1} disabled={useMax} value={countText} onChange={(e) => setCountText(e.target.value)} />
      </label>
      <label className="row">
        <input type="checkbox" checked={useMax} onChange={(e) => setUseMax(e.target.checked)} /> Максимум
      </label>
      {size && <p className="hint">На лист помещается: {max}</p>}
      {msg && <p className="hint danger">{msg}</p>}
      <button disabled={!size || !countOk || max === 0} onClick={() => size && fillIdentical(size, useMax ? 'max' : requested)}>
        Разместить
      </button>
    </fieldset>
  )
}

function BackgroundBlock() {
  const sheet = useCollageStore((s) => s.collage.sheet)
  const setBackground = useCollageStore((s) => s.setBackground)
  const bg = sheet.background
  const cut = sheet.kind === 'cut'
  const switchType = (type: Background['type']) => {
    if (type === 'color') setBackground({ type: 'color', color: '#ffffff' })
    else if (type === 'gradient') setBackground({ type: 'gradient', from: '#ffffff', to: '#cfd8e3', angleDeg: 90 })
    else setBackground({ type: 'texture', id: 'paper' })
  }
  return (
    <fieldset className="effects" disabled={cut}>
      <legend>Фон</legend>
      <div className="seg" role="group" aria-label="Тип фона">
        {(
          [
            ['color', 'Цвет'],
            ['gradient', 'Градиент'],
            ['texture', 'Текстура'],
          ] as const
        ).map(([t, name]) => (
          <button key={t} className={bg.type === t ? 'on' : ''} onClick={() => switchType(t)}>
            {name}
          </button>
        ))}
      </div>
      {bg.type === 'color' && <input type="color" value={bg.color} onChange={(e) => setBackground({ type: 'color', color: e.target.value })} />}
      {bg.type === 'gradient' && (
        <>
          <div className="fx-actions">
            <input type="color" value={bg.from} onChange={(e) => setBackground({ ...bg, from: e.target.value })} />
            <input type="color" value={bg.to} onChange={(e) => setBackground({ ...bg, to: e.target.value })} />
          </div>
          <label>
            <span className="fx-label">
              Угол, °<span className="hint">{bg.angleDeg}</span>
            </span>
            <input type="range" min={0} max={360} value={bg.angleDeg} onChange={(e) => setBackground({ ...bg, angleDeg: parseInt(e.target.value, 10) })} />
          </label>
        </>
      )}
      {bg.type === 'texture' && (
        <select value={bg.id} onChange={(e) => setBackground({ type: 'texture', id: e.target.value as TextureId })}>
          {TEXTURES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      )}
      {cut && <p className="hint">На листе для вырезания фон не печатается: бумага остаётся белой.</p>}
    </fieldset>
  )
}

export function SheetToolbar() {
  const s = useCollageStore()
  const addFiles = useLibraryStore((l) => l.addFiles)
  const inputRef = useRef<HTMLInputElement>(null)
  const { sheet } = s.collage

  return (
    <aside className="fit-controls collage-toolbar">
      <div className="fx-actions">
        <button disabled={!s.canUndo} onClick={s.undo} title="Отменить (⌘Z)">
          Отменить
        </button>
        <button disabled={!s.canRedo} onClick={s.redo} title="Повторить (⇧⌘Z)">
          Повторить
        </button>
      </div>
      <button className="primary" onClick={() => inputRef.current?.click()}>
        Добавить фото…
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

      <div className="seg" role="group" aria-label="Вид листа">
        <button className={sheet.kind === 'album' ? 'on' : ''} onClick={() => s.setKind('album')}>
          Страница альбома
        </button>
        <button className={sheet.kind === 'cut' ? 'on' : ''} onClick={() => s.setKind('cut')}>
          Лист для вырезания
        </button>
      </div>
      <p className="hint">
        {sheet.kind === 'album'
          ? 'Печатаются фон, фото, рамки и тени вместе.'
          : 'Печатаются только фото с рамками; фон и тени скрыты. Метки обрезки включены.'}
      </p>

      <div className="seg" role="group" aria-label="Ориентация листа">
        <button className={sheet.orientation === 'portrait' ? 'on' : ''} onClick={() => s.setOrientation('portrait')}>
          Книжная
        </button>
        <button className={sheet.orientation === 'landscape' ? 'on' : ''} onClick={() => s.setOrientation('landscape')}>
          Альбомная
        </button>
      </div>

      <SpacingField label="Поля, мм" value={sheet.safeMarginMm} onCommit={s.setSafeMargin} />
      <SpacingField label="Зазор между фото, мм" value={sheet.gapMm} onCommit={s.setGap} />
      <label className="row">
        <input type="checkbox" checked={sheet.cropMarks} onChange={(e) => s.setCropMarks(e.target.checked)} /> Метки обрезки
      </label>

      <fieldset className="effects">
        <legend>Шаблон</legend>
        <div className="seg" role="group" aria-label="Шаблоны">
          {TEMPLATES.map((t) => (
            <button key={t.id} onClick={() => s.applyTemplate(t.id)} title={t.label}>
              {t.id}
            </button>
          ))}
        </div>
        <p className="hint">Шаблон подставит уже расставленные фото по порядку.</p>
      </fieldset>

      <IdenticalBlock />
      <BackgroundBlock />
    </aside>
  )
}
