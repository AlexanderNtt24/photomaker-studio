import { useEffect, useRef } from 'react'
import type { LoadedImage } from '../../core/image/load'

function ThumbCanvas({ bitmap }: { bitmap: ImageBitmap }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const side = 144
    c.width = side
    c.height = side
    const k = Math.max(side / bitmap.width, side / bitmap.height)
    const w = bitmap.width * k
    const h = bitmap.height * k
    c.getContext('2d')!.drawImage(bitmap, (side - w) / 2, (side - h) / 2, w, h)
  }, [bitmap])
  return <canvas ref={ref} />
}

type Props = {
  images: LoadedImage[]
  selectedId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export function Thumbs({ images, selectedId, onSelect, onRemove }: Props) {
  return (
    <div className="fit-thumbs" aria-label="Загруженные фото">
      {images.map((img) => (
        <div key={img.id} className="thumb-wrap">
          <button
            className={'thumb' + (img.id === selectedId ? ' selected' : '')}
            title={img.name}
            onClick={() => onSelect(img.id)}
          >
            <ThumbCanvas bitmap={img.preview} />
          </button>
          <button className="x" title="Убрать" onClick={() => onRemove(img.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
