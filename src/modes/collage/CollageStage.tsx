import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer as KLayer, Rect, Transformer } from 'react-konva'
import type Konva from 'konva'
import { useCollageStore } from './collageStore'
import { useLibraryStore } from '../../core/library/libraryStore'
import { renderCollage, type AssetLookup, type WindowCache } from '../../core/render/renderCollage'
import type { CanvasFactory, RenderSource } from '../../core/render/renderFit'
import { sheetSizeMm } from '../../core/collage/model'
import { prepareStickers, type StickerLookup } from '../../core/stickers/raster'
import { decodeStickerDom } from '../../core/stickers/decodeDom'
import { useImportedStickers } from '../../core/stickers/imported'
import { fromNode, stageScale, toNode } from './stageGeometry'

const createDomCanvas: CanvasFactory = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function CollageStage() {
  const collage = useCollageStore((s) => s.collage)
  const selectedId = useCollageStore((s) => s.selectedLayerId)
  const { updateLayer, select } = useCollageStore.getState()
  const images = useLibraryStore((s) => s.images)

  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const nodes = useRef(new Map<string, Konva.Rect>())
  const cache = useRef<WindowCache>(new Map())
  const stickerCache = useRef(new Map<string, Promise<RenderSource | undefined>>())
  const importedItems = useImportedStickers((s) => s.items)
  const [stickers, setStickers] = useState<StickerLookup | undefined>(undefined)
  const [box, setBox] = useState({ width: 800, height: 1000 })

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ width: el.clientWidth, height: el.clientHeight }))
    ro.observe(el)
    setBox({ width: el.clientWidth, height: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const selectedType = collage.layers.find((l) => l.id === selectedId)?.type
  const sheetMm = sheetSizeMm(collage.sheet)
  const scale = stageScale(box, sheetMm)
  const cssW = sheetMm.widthMm * scale
  const cssH = sheetMm.heightMm * scale

  const assets: AssetLookup = useMemo(
    () => (id) => {
      const img = images.find((i) => i.id === id)
      return img ? { full: img.full, preview: img.preview } : undefined
    },
    [images],
  )

  // Стикеры растеризуются асинхронно под dpi предпросмотра; лист перерисовывается, когда они готовы.
  useEffect(() => {
    let alive = true
    const dpi = scale * 25.4 * (window.devicePixelRatio || 1)
    void prepareStickers(collage, dpi, decodeStickerDom, (id) => useImportedStickers.getState().byId(id), stickerCache.current).then((l) => alive && setStickers(() => l))
    return () => {
      alive = false
    }
  }, [collage, scale, importedItems])

  // Предпросмотр — тот же renderCollage, что и при экспорте, но с preview-копиями и dpi под размер сцены.
  useEffect(() => {
    const view = canvasRef.current
    if (!view) return
    const dpr = window.devicePixelRatio || 1
    const dpi = scale * 25.4 * dpr
    const out = renderCollage(
      collage,
      assets,
      { dpi, source: 'preview', placeholders: true, drawMarks: collage.sheet.cropMarks, stickers },
      createDomCanvas,
      cache.current,
    ) as HTMLCanvasElement
    view.width = out.width
    view.height = out.height
    view.getContext('2d')!.drawImage(out, 0, 0)
  }, [collage, assets, scale, stickers])

  // Кэш окон привязан к набору фото: после замены библиотеки старые окна не нужны.
  useEffect(() => {
    cache.current.clear()
  }, [images])

  useEffect(() => {
    const tr = trRef.current
    if (!tr) return
    const node = selectedId ? nodes.current.get(selectedId) : undefined
    tr.nodes(node ? [node] : [])
    tr.getLayer()?.batchDraw()
  }, [selectedId, collage.layers])

  const push = (id: string, node: Konva.Rect) => {
    updateLayer(
      id,
      fromNode(
        { x: node.x(), y: node.y(), width: node.width(), height: node.height(), scaleX: node.scaleX(), scaleY: node.scaleY(), rotation: node.rotation() },
        scale,
      ),
    )
    // Масштаб «запекаем» в размер, чтобы узел всегда оставался со scale = 1.
    node.scaleX(1)
    node.scaleY(1)
  }

  return (
    <div className="collage-box" ref={boxRef}>
      <div className="collage-sheet" style={{ width: cssW, height: cssH }}>
        <canvas ref={canvasRef} style={{ width: cssW, height: cssH }} />
        <Stage
          width={cssW}
          height={cssH}
          style={{ position: 'absolute', inset: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) select(null)
          }}
        >
          <KLayer>
            {collage.layers.map((l) => (
              <Rect
                key={l.id}
                ref={(n) => {
                  if (n) nodes.current.set(l.id, n)
                  else nodes.current.delete(l.id)
                }}
                {...toNode(l, scale)}
                fill="rgba(0,0,0,0.001)"
                draggable
                onMouseDown={() => select(l.id)}
                onTap={() => select(l.id)}
                onDragMove={(e) => push(l.id, e.target as Konva.Rect)}
                onTransform={(e) => push(l.id, e.target as Konva.Rect)}
              />
            ))}
            <Transformer ref={trRef} rotateEnabled keepRatio={selectedType === 'sticker'} flipEnabled={false} ignoreStroke boundBoxFunc={(o, n) => (n.width < 10 || n.height < 10 ? o : n)} />
          </KLayer>
        </Stage>
      </div>
    </div>
  )
}
