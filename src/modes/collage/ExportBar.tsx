import { useEffect, useMemo, useRef, useState } from 'react'
import { registerCommand } from '../../app/commands'
import { useCollageStore } from './collageStore'
import { useLibraryStore } from '../../core/library/libraryStore'
import { useImportedStickers } from '../../core/stickers/imported'
import { systemFontAvailable } from '../../core/collage/fontCheck'
import { collageWarnings } from '../../core/collage/warnings'
import type { AssetLookup } from '../../core/render/renderCollage'
import { canExport, exportBaseName, renderSheetPdf, renderSheetPng, warningText } from './exportCollage'

export function ExportBar() {
  const collage = useCollageStore((s) => s.collage)
  const setDpi = useCollageStore((s) => s.setDpi)
  const images = useLibraryStore((s) => s.images)
  const importedById = useImportedStickers((s) => s.byId)
  const importedItems = useImportedStickers((s) => s.items)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [dpiText, setDpiText] = useState(String(collage.sheet.dpi))
  useEffect(() => setDpiText(String(collage.sheet.dpi)), [collage.sheet.dpi])

  const warnings = useMemo(() => collageWarnings(collage, images, { fontAvailable: systemFontAvailable, importedAvailable: (id) => !!importedById(id) }), [collage, images, importedById, importedItems])
  const blocked = canExport(collage)
  const assets: AssetLookup = (id) => {
    const img = images.find((i) => i.id === id)
    return img ? { full: img.full, preview: img.preview } : undefined
  }

  const run = async (ext: 'png' | 'pdf') => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setStatus('Готовлю файл…')
    try {
      // Берём свежее состояние: за время рендера интерфейс мог измениться.
      const c = useCollageStore.getState().collage
      const bytes = ext === 'png' ? await renderSheetPng(c, assets) : await renderSheetPdf(c, assets)
      const name = `${exportBaseName(c.sheet.kind)}.${ext}`
      const ok = ext === 'png' ? await window.api?.savePng(name, bytes) : await window.api?.savePdf(name, bytes)
      setStatus(ok ? 'Сохранено' + (ext === 'pdf' ? '. Печатайте в масштабе 100%, без «вписать в страницу».' : '') : null)
    } catch (e) {
      setStatus('Ошибка экспорта: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  const commitDpi = () => setDpi(parseInt(dpiText, 10))

  // Меню и ⌘E/⇧⌘E: всегда берут актуальные run и blocked, во время экспорта и при блокировке не запускаются.
  const latest = useRef({ run, blocked })
  latest.current = { run, blocked }
  useEffect(() => {
    const go = (ext: 'png' | 'pdf') => () => {
      if (latest.current.blocked === null) void latest.current.run(ext)
    }
    const offs = [registerCommand('export-png', go('png')), registerCommand('export-pdf', go('pdf'))]
    return () => offs.forEach((off) => off())
  }, [])

  return (
    <div className="collage-export">
      <label className="row">
        Разрешение листа, dpi
        <input
          type="number"
          min={150}
          max={600}
          value={dpiText}
          onChange={(e) => setDpiText(e.target.value)}
          onBlur={commitDpi}
          onKeyDown={(e) => e.key === 'Enter' && commitDpi()}
        />
      </label>
      <button className="primary" disabled={busy || blocked !== null} onClick={() => void run('png')}>
        Экспорт PNG
      </button>
      <button className="primary" disabled={busy || blocked !== null} onClick={() => void run('pdf')}>
        Экспорт PDF
      </button>
      {blocked && <span className="hint danger">{blocked}</span>}
      {status && <span className="hint">{status}</span>}
      {warnings.length > 0 && (
        <ul className="collage-warnings" aria-label="Предупреждения">
          {warnings.map((w, i) => (
            <li key={i} className={'w-' + w.level}>
              <button className="link" onClick={() => useCollageStore.getState().select(w.layerId)}>
                {warningText(w)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
