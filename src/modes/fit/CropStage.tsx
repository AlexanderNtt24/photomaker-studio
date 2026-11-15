import { useEffect, useRef } from 'react'
import { useFitStore, targetSizeMm, DEFAULT_CROP } from './fitStore'
import { renderFit, type CanvasFactory } from '../../core/render/renderFit'
import { NO_EFFECTS } from '../../core/effects/types'
import { cropRect } from '../../core/fit/geometry'

const PREVIEW_LONG_SIDE_PX = 900
const MAX_ZOOM = 8

const createDomCanvas: CanvasFactory = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function CropStage() {
  const state = useFitStore()
  const { images, selectedId, mode, marginColor, cropById, setCrop } = state
  const img = images.find((i) => i.id === selectedId) ?? null
  const size = targetSizeMm(state)
  const crop = (img && cropById[img.id]) || DEFAULT_CROP
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null)

  useEffect(() => {
    const view = canvasRef.current
    if (!view || !img || !size) return
    // Предпросмотр — тот же renderFit, что и при экспорте, только с малым dpi и уменьшенной копией.
    const dpi = (PREVIEW_LONG_SIDE_PX * 25.4) / Math.max(size.widthMm, size.heightMm)
    const out = renderFit(
      img.preview,
      { ...size, mode, crop, marginColor, effects: NO_EFFECTS },
      dpi,
      createDomCanvas,
    ) as HTMLCanvasElement
    view.width = out.width
    view.height = out.height
    view.getContext('2d')!.drawImage(out, 0, 0)
  }, [img, size?.widthMm, size?.heightMm, mode, crop, marginColor]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!img) return <p className="fit-empty">Перетащите фото сюда или нажмите «Выбрать файлы…». Поддерживаются JPG, PNG, WebP и HEIC.</p>
  if (!size) return <p className="fit-empty">Введите корректный размер (от 0 до 1000 мм).</p>

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode !== 'crop') return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, cx: crop.cx, cy: crop.cy }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    if (!d) return
    const rect = e.currentTarget.getBoundingClientRect()
    const frame = cropRect(img.width, img.height, size.widthMm / size.heightMm, crop)
    // Тянем фото, поэтому рамка движется в обратную сторону.
    const cx = d.cx - ((e.clientX - d.x) / rect.width) * (frame.width / img.width)
    const cy = d.cy - ((e.clientY - d.y) / rect.height) * (frame.height / img.height)
    setCrop(img.id, { ...crop, cx: Math.min(1, Math.max(0, cx)), cy: Math.min(1, Math.max(0, cy)) })
  }
  const onPointerUp = () => {
    drag.current = null
  }
  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (mode !== 'crop') return
    const zoom = Math.min(MAX_ZOOM, Math.max(1, crop.zoom * Math.exp(-e.deltaY * 0.002)))
    setCrop(img.id, { ...crop, zoom })
  }

  return (
    <canvas
      ref={canvasRef}
      className={mode === 'crop' ? 'crop-canvas draggable' : 'crop-canvas'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    />
  )
}
