import type { StickerDecoder } from './raster'

/** Декодер для приложения: картинка (в том числе SVG) рисуется как изображение, скрипты и внешние ссылки не исполняются. */
export const decodeStickerDom: StickerDecoder = async (bytes, mime, w, h) => {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }))
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return c
  } finally {
    URL.revokeObjectURL(url)
  }
}
