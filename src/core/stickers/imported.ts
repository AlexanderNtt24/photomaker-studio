import { create } from 'zustand'

export type ImportedSticker = { id: string; name: string; mime: string; data: Uint8Array }

type ImportedState = {
  items: ImportedSticker[]
  add: (s: ImportedSticker) => void
  byId: (id: string) => ImportedSticker | undefined
  clear: () => void
}

/** Стикеры, импортированные пользователем или пришедшие из открытого проекта. */
export const useImportedStickers = create<ImportedState>((set, get) => ({
  items: [],
  add: (s) => set((st) => ({ items: [...st.items.filter((x) => x.id !== s.id), s] })),
  byId: (id) => get().items.find((x) => x.id === id),
  clear: () => set({ items: [] }),
}))

export const MAX_STICKER_BYTES = 5 * 1024 * 1024
export const MAX_STICKER_PX = 4096

const MIME_BY_EXT: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', webp: 'image/webp' }
const extOf = (name: string) => name.toLowerCase().split('.').pop() ?? ''
/** Тип берём по расширению, а не по заявленному браузером: он и пойдёт в проект. */
const mimeOf = (f: { name: string; type: string }) => MIME_BY_EXT[extOf(f.name)] ?? (Object.values(MIME_BY_EXT).includes(f.type) ? f.type : null)

export function validateStickerFile(f: { name: string; type: string; size: number }): string | null {
  if (!mimeOf(f)) return 'Подходят только файлы SVG, PNG и WebP.'
  if (f.size <= 0) return 'Файл пустой.'
  if (f.size > MAX_STICKER_BYTES) return 'Файл больше 5 МБ: возьмите картинку полегче.'
  return null
}

/** Картинка SVG рисуется только как изображение, но явно опасное содержимое не принимаем вовсе. */
export function checkSvgText(svg: string): string | null {
  if (svg.trim() === '') return 'Файл SVG пустой.'
  if (!/<svg[\s>]/i.test(svg)) return 'Это не SVG-рисунок.'
  if (/<script|<foreignObject|<!ENTITY|\son[a-z]+\s*=/i.test(svg)) return 'В SVG есть скрипты или встроенные страницы: такой файл не принимается.'
  return null
}

export function stickerPixelsOk(width: number, height: number): string | null {
  if (!(width > 0) || !(height > 0)) return 'У картинки нет размера.'
  if (width > MAX_STICKER_PX || height > MAX_STICKER_PX) return `Картинка больше ${MAX_STICKER_PX} пикселей по стороне: уменьшите её.`
  return null
}

/** Отношение сторон SVG: viewBox, иначе width/height, иначе 1:1. */
function svgAspect(svg: string): number {
  const tag = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? ''
  const vb = /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)\s*["']/i.exec(tag)
  if (vb) {
    const a = Number(vb[3]) / Number(vb[4])
    if (Number.isFinite(a) && a > 0) return a
  }
  const w = /\swidth\s*=\s*["']\s*([\d.]+)/i.exec(tag)
  const h = /\sheight\s*=\s*["']\s*([\d.]+)/i.exec(tag)
  if (w && h) {
    const a = Number(w[1]) / Number(h[1])
    if (Number.isFinite(a) && a > 0) return a
  }
  return 1
}

const measureDom = async (blob: Blob) => {
  const bmp = await createImageBitmap(blob)
  const r = { width: bmp.width, height: bmp.height }
  bmp.close()
  return r
}

export type ImportResult = { ok: true; sticker: ImportedSticker; aspect: number } | { ok: false; error: string }

/** Читает файл, проверяет его и регистрирует в наборе импортированных. Ничего не регистрирует при отказе. */
export async function importStickerFile(
  file: File,
  measure: (blob: Blob) => Promise<{ width: number; height: number }> = measureDom,
): Promise<ImportResult> {
  const bad = validateStickerFile(file)
  if (bad) return { ok: false, error: bad }
  const mime = mimeOf(file) as string
  try {
    const data = new Uint8Array(await file.arrayBuffer())
    let aspect = 1
    if (mime === 'image/svg+xml') {
      const text = new TextDecoder().decode(data)
      const why = checkSvgText(text)
      if (why) return { ok: false, error: why }
      aspect = svgAspect(text)
    } else {
      const { width, height } = await measure(new Blob([data as BlobPart], { type: mime }))
      const why = stickerPixelsOk(width, height)
      if (why) return { ok: false, error: why }
      aspect = width / height
    }
    const sticker: ImportedSticker = { id: crypto.randomUUID(), name: file.name.slice(0, 200), mime, data }
    useImportedStickers.getState().add(sticker)
    return { ok: true, sticker, aspect }
  } catch {
    return { ok: false, error: 'Не удалось прочитать картинку: файл повреждён.' }
  }
}
