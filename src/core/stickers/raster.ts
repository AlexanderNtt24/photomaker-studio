import { isSticker, type Collage, type StickerLayer } from '../collage/model'
import type { RenderSource } from '../render/renderFit'
import { builtinById } from './catalog'

export const MAX_STICKER_SIDE_PX = 8192

export type StickerLookup = (l: StickerLayer) => RenderSource | undefined
export type StickerDecoder = (bytes: Uint8Array, mime: string, widthPx: number, heightPx: number) => Promise<RenderSource>
type ImportedLookup = (id: string) => { data: Uint8Array; mime: string } | undefined

/** Размер растра слоя в пикселях при данном dpi; длинная сторона не больше потолка, пропорции сохраняются. */
export function stickerPixels(l: Pick<StickerLayer, 'widthMm' | 'heightMm'>, dpi: number): { w: number; h: number } {
  const k = dpi / 25.4
  let w = Math.max(1, Math.ceil(l.widthMm * k))
  let h = Math.max(1, Math.ceil(l.heightMm * k))
  const over = Math.max(w, h) / MAX_STICKER_SIDE_PX
  if (over > 1) {
    w = Math.max(1, Math.floor(w / over))
    h = Math.max(1, Math.floor(h / over))
  }
  return { w, h }
}

const keyOf = (l: StickerLayer, w: number, h: number) => `${l.source.kind}:${l.source.id}|${w}x${h}`

/**
 * Растеризует каждый уникальный стикер листа в размер слоя при данном dpi, чтобы синхронный renderCollage
 * получил готовые холсты и вектор оставался чётким на любом разрешении.
 * Потерянный источник или ошибка декодирования: стикер не попадает в таблицу, остальное рисуется.
 */
export async function prepareStickers(c: Collage, dpi: number, decode: StickerDecoder, imported: ImportedLookup): Promise<StickerLookup> {
  const jobs = new Map<string, Promise<RenderSource | undefined>>()
  for (const l of c.layers) {
    if (!isSticker(l)) continue
    const { w, h } = stickerPixels(l, dpi)
    const key = keyOf(l, w, h)
    if (jobs.has(key)) continue
    jobs.set(
      key,
      (async () => {
        try {
          if (l.source.kind === 'builtin') {
            const b = builtinById(l.source.id)
            return b ? await decode(new TextEncoder().encode(b.svg), 'image/svg+xml', w, h) : undefined
          }
          const a = imported(l.source.id)
          return a ? await decode(a.data, a.mime, w, h) : undefined
        } catch {
          return undefined
        }
      })(),
    )
  }
  const done = new Map<string, RenderSource>()
  await Promise.all([...jobs].map(async ([k, p]) => {
    const r = await p
    if (r) done.set(k, r)
  }))
  return (l) => {
    const { w, h } = stickerPixels(l, dpi)
    return done.get(keyOf(l, w, h))
  }
}
