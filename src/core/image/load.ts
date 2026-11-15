export type LoadedImage = {
  id: string
  name: string
  /** Размеры уже с учётом EXIF-ориентации */
  width: number
  height: number
  full: ImageBitmap
  /** Уменьшенная копия для быстрого предпросмотра */
  preview: ImageBitmap
}

export type LoadResult = { ok: true; image: LoadedImage } | { ok: false; name: string; error: string }

export const PREVIEW_MAX_SIDE = 1600

export function isHeic(file: { name: string; type: string }): boolean {
  return /\.hei[cf]$/i.test(file.name) || /^image\/hei[cf]$/i.test(file.type)
}

export function previewSize(w: number, h: number, maxSide: number): { width: number; height: number } {
  const longSide = Math.max(w, h)
  if (longSide <= maxSide) return { width: w, height: h }
  const k = maxSide / longSide
  return { width: Math.round(w * k), height: Math.round(h * k) }
}

let heicWorker: Worker | null = null
let heicSeq = 0

function decodeHeic(blob: Blob): Promise<ImageBitmap> {
  heicWorker ??= new Worker(new URL('./heic.worker.ts', import.meta.url), { type: 'module' })
  const worker = heicWorker
  const id = ++heicSeq
  return new Promise((resolve, reject) => {
    const onMessage = (e: MessageEvent<{ id: number; bitmap?: ImageBitmap; error?: string }>) => {
      if (e.data.id !== id) return
      worker.removeEventListener('message', onMessage)
      if (e.data.bitmap) resolve(e.data.bitmap)
      else reject(new Error(e.data.error ?? 'HEIC decode failed'))
    }
    worker.addEventListener('message', onMessage)
    worker.postMessage({ id, blob })
  })
}

export async function loadImage(file: File): Promise<LoadResult> {
  const fail = (error: string): LoadResult => ({ ok: false, name: file.name, error })
  try {
    if (file.size === 0) return fail('Пустой файл')
    const full = isHeic(file)
      ? await decodeHeic(file)
      : await createImageBitmap(file, { imageOrientation: 'from-image' })
    const ps = previewSize(full.width, full.height, PREVIEW_MAX_SIDE)
    const preview =
      ps.width === full.width && ps.height === full.height
        ? full
        : await createImageBitmap(full, { resizeWidth: ps.width, resizeHeight: ps.height, resizeQuality: 'high' })
    return {
      ok: true,
      image: { id: crypto.randomUUID(), name: file.name, width: full.width, height: full.height, full, preview },
    }
  } catch {
    return fail('Не удалось прочитать изображение: файл повреждён или формат не поддерживается')
  }
}
