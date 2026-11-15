import { mmToPx } from '../formats'
import { renderFit, type CanvasFactory, type CanvasLike, type RenderSource } from './renderFit'
import { drawBackground, type Ctx2D } from './background'
import { cropMarkSegments } from '../collage/marks'
import { effectiveFrameMm, isPhoto, isSticker, isText, photoWindow, sheetSizeMm, type Collage, type PhotoLayer, type StickerLayer, type TextLayer } from '../collage/model'
import type { StickerLookup } from '../stickers/raster'
import { fontCss, fontPx, LINE_HEIGHT, wrapText } from '../collage/fonts'

export type AssetLookup = (imageId: string) => { full: RenderSource; preview: RenderSource } | undefined
export type RenderOptions = { dpi: number; source: 'preview' | 'full'; placeholders: boolean; drawMarks: boolean; stickers?: StickerLookup }
export type WindowCache = Map<string, CanvasLike>

const CACHE_LIMIT = 64

/** Слои, которые реально попадут на лист: пустые и потерянные без заглушек не рисуются и меток не получают. */
export function printedLayers(c: Collage, assets: AssetLookup, placeholders: boolean): PhotoLayer[] {
  return c.layers.filter(isPhoto).filter((l) => (l.imageId ? assets(l.imageId) : undefined) || placeholders)
}

function roundedRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  if (rr === 0) {
    ctx.rect(x, y, w, h)
  } else {
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }
}

function drawPlaceholder(ctx: Ctx2D, x: number, y: number, w: number, h: number, step: number): void {
  ctx.fillStyle = '#d4d4d8'
  ctx.fillRect(x, y, w, h)
  ctx.strokeStyle = '#a1a1aa'
  ctx.lineWidth = Math.max(1, step / 8)
  ctx.beginPath()
  for (let d = -h; d < w; d += step) {
    ctx.moveTo(x + d, y + h)
    ctx.lineTo(x + d + h, y)
  }
  ctx.stroke()
}

/**
 * Единственная функция, которая рисует лист: и для предпросмотра (preview + малый dpi),
 * и для экспорта (full + dpi листа). Окна фото кэшируются, чтобы перетаскивание не пересчитывало эффекты.
 */
export function renderCollage(
  c: Collage,
  assets: AssetLookup,
  o: RenderOptions,
  create: CanvasFactory,
  cache?: WindowCache,
): CanvasLike {
  const { sheet } = c
  const size = sheetSizeMm(sheet)
  const W = mmToPx(size.widthMm, o.dpi)
  const H = mmToPx(size.heightMm, o.dpi)
  const out = create(W, H)
  const ctx = out.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const s = o.dpi / 25.4 // пикселей в миллиметре

  if (sheet.kind === 'album') {
    drawCachedBackground(ctx)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
  }

  for (const l of c.layers) {
    if (isPhoto(l)) drawPhotoLayer(ctx, l)
    else if (isText(l) && sheet.kind === 'album') drawTextLayer(ctx, l)
    else if (isSticker(l) && sheet.kind === 'album') drawStickerLayer(ctx, l)
  }
  if (o.drawMarks) drawMarks(ctx)
  return out

  /** Текстура и градиент считаются заметно дольше окон фото: при перетаскивании берём готовый фон из кэша. */
  function drawCachedBackground(ctx: Ctx2D): void {
    const bg = sheet.background
    if (!cache || bg.type === 'color') return drawBackground(ctx, bg, W, H)
    const key = `bg|${JSON.stringify(bg)}|${W}x${H}`
    let layer = cache.get(key)
    if (!layer) {
      layer = create(W, H)
      drawBackground(layer.getContext('2d'), bg, W, H)
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
      cache.set(key, layer)
    }
    ctx.drawImage(layer as unknown as CanvasImageSource, 0, 0)
  }

  function drawMarks(ctx: Ctx2D): void {
    // Только слои, которые реально печатаются: пустые слоты без заглушек меток не получают.
    const printed = printedLayers(c, assets, o.placeholders)
    const segs = cropMarkSegments(printed, size)
    ctx.lineCap = 'butt'
    // Белая подложка, чтобы метка читалась и на тёмном фоне; чёрная линия 0,2 мм (не тоньше 1 px).
    for (const [color, widthMm] of [['#ffffff', 0.6], ['#000000', 0.2]] as const) {
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(1, widthMm * s)
      ctx.beginPath()
      for (const g of segs) {
        ctx.moveTo(g.x1 * s, g.y1 * s)
        ctx.lineTo(g.x2 * s, g.y2 * s)
      }
      ctx.stroke()
    }
  }

  function drawPhotoLayer(ctx: Ctx2D, l: PhotoLayer): void {
    const asset = l.imageId ? assets(l.imageId) : undefined
    if (!asset && !o.placeholders) return
    const w = l.widthMm * s
    const h = l.heightMm * s
    const frame = effectiveFrameMm(l)
    const win = photoWindow(l)
    const radius = l.cornerRadiusMm * s

    ctx.save()
    ctx.translate((l.xMm + l.widthMm / 2) * s, (l.yMm + l.heightMm / 2) * s)
    ctx.rotate((l.rotationDeg * Math.PI) / 180)
    ctx.translate(-w / 2, -h / 2)

    if (sheet.kind === 'album' && l.shadow.enabled) {
      ctx.save()
      ctx.shadowColor = `rgba(0,0,0,${l.shadow.opacity})`
      ctx.shadowBlur = l.shadow.blurMm * s
      // Смещение тени задано в координатах листа и не зависит от поворота слоя (так в спецификации canvas).
      ctx.shadowOffsetX = l.shadow.offsetMm * s
      ctx.shadowOffsetY = l.shadow.offsetMm * s
      ctx.fillStyle = frame > 0 ? l.frame.color : '#ffffff'
      roundedRect(ctx, 0, 0, w, h, radius)
      ctx.fill()
      ctx.restore()
    }

    if (frame > 0) {
      ctx.fillStyle = l.frame.color
      roundedRect(ctx, 0, 0, w, h, radius)
      ctx.fill()
    }

    const wx = win.x * s
    const wy = win.y * s
    const ww = win.width * s
    const wh = win.height * s
    ctx.save()
    roundedRect(ctx, wx, wy, ww, wh, Math.max(0, radius - frame * s))
    ctx.clip()
    if (asset) {
      ctx.drawImage(windowCanvas(l, asset, win.width, win.height) as unknown as CanvasImageSource, wx, wy, ww, wh)
    } else {
      drawPlaceholder(ctx, wx, wy, ww, wh, Math.max(6, Math.min(ww, wh) / 8))
    }
    ctx.restore()
    ctx.restore()
  }

  function drawStickerLayer(ctx: Ctx2D, l: StickerLayer): void {
    const raster = o.stickers?.(l)
    if (!raster) return
    const w = l.widthMm * s
    const h = l.heightMm * s
    ctx.save()
    ctx.translate((l.xMm + l.widthMm / 2) * s, (l.yMm + l.heightMm / 2) * s)
    ctx.rotate((l.rotationDeg * Math.PI) / 180)
    ctx.globalAlpha = l.opacity
    ctx.drawImage(raster as unknown as CanvasImageSource, -w / 2, -h / 2, w, h)
    ctx.restore()
  }

  function drawTextLayer(ctx: Ctx2D, l: TextLayer): void {
    if (l.text.trim() === '') return
    const w = l.widthMm * s
    const h = l.heightMm * s
    ctx.save()
    ctx.translate((l.xMm + l.widthMm / 2) * s, (l.yMm + l.heightMm / 2) * s)
    ctx.rotate((l.rotationDeg * Math.PI) / 180)
    ctx.translate(-w / 2, -h / 2)
    ctx.beginPath()
    ctx.rect(0, 0, w, h)
    ctx.clip()
    ctx.globalAlpha = l.opacity
    ctx.font = fontCss(l, s)
    ctx.fillStyle = l.color
    ctx.textBaseline = 'top'
    ctx.textAlign = l.align
    const lines = wrapText(l.text, w, (t) => ctx.measureText(t).width)
    const lineH = fontPx(l.fontSizePt, s) * LINE_HEIGHT
    const x = l.align === 'left' ? 0 : l.align === 'center' ? w / 2 : w
    lines.forEach((t, i) => {
      if ((i - 1) * lineH > h) return
      ctx.fillText(t, x, i * lineH)
    })
    ctx.restore()
  }

  function windowCanvas(
    l: PhotoLayer,
    asset: { full: RenderSource; preview: RenderSource },
    widthMm: number,
    heightMm: number,
  ): CanvasLike {
    const key = [l.imageId, o.source, mmToPx(widthMm, o.dpi), mmToPx(heightMm, o.dpi), JSON.stringify(l.crop), JSON.stringify(l.effects)].join('|')
    const hit = cache?.get(key)
    if (hit) return hit
    const rendered = renderFit(
      o.source === 'full' ? asset.full : asset.preview,
      { widthMm, heightMm, mode: 'crop', crop: l.crop, marginColor: '#ffffff', effects: l.effects },
      o.dpi,
      create,
    )
    if (cache) {
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string)
      cache.set(key, rendered)
    }
    return rendered
  }
}
