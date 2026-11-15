import { useEffect, useMemo, useRef, useState } from 'react'
import { useCollageStore } from './collageStore'
import { BUILTIN_STICKERS } from '../../core/stickers/catalog'
import { importStickerFile, useImportedStickers } from '../../core/stickers/imported'

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

export function StickerPanel() {
  const addSticker = useCollageStore((s) => s.addSticker)
  const items = useImportedStickers((s) => s.items)
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [aspects] = useState(() => new Map<string, number>())

  // Миниатюры импортированных — адреса на время жизни списка.
  const thumbs = useMemo(() => items.map((i) => ({ item: i, url: URL.createObjectURL(new Blob([i.data as BlobPart], { type: i.mime })) })), [items])
  useEffect(() => () => thumbs.forEach((t) => URL.revokeObjectURL(t.url)), [thumbs])

  const onFiles = async (files: File[]) => {
    setError(null)
    for (const f of files) {
      const r = await importStickerFile(f)
      if (!r.ok) {
        setError(`${f.name}: ${r.error}`)
        continue
      }
      aspects.set(r.sticker.id, r.aspect)
      addSticker({ kind: 'imported', id: r.sticker.id }, r.aspect)
    }
  }

  return (
    <fieldset className="effects">
      <legend>Стикеры</legend>
      <div className="sticker-grid">
        {BUILTIN_STICKERS.map((b) => (
          <button key={b.id} className="sticker-thumb" title={b.label} aria-label={b.label} onClick={() => addSticker({ kind: 'builtin', id: b.id }, b.aspect)}>
            <img src={svgUrl(b.svg)} alt="" draggable={false} />
          </button>
        ))}
        {thumbs.map(({ item, url }) => (
          <button
            key={item.id}
            className="sticker-thumb"
            title={item.name}
            aria-label={item.name}
            onClick={() => {
              const img = new Image()
              img.onload = () => addSticker({ kind: 'imported', id: item.id }, aspects.get(item.id) ?? (img.naturalWidth / img.naturalHeight || 1))
              img.onerror = () => addSticker({ kind: 'imported', id: item.id }, aspects.get(item.id) ?? 1)
              img.src = url
            }}
          >
            <img src={url} alt="" draggable={false} />
          </button>
        ))}
      </div>
      <button onClick={() => inputRef.current?.click()}>Импортировать…</button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          if (files.length) void onFiles(files)
        }}
      />
      {error && <p className="hint danger">{error}</p>}
      <p className="hint">SVG, PNG или WebP до 5 МБ. Импортированный файл сохраняется внутри проекта.</p>
    </fieldset>
  )
}
