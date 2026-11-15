/** Минимум от Worker, который нужен декодеру: так его можно проверить без браузера. */
export interface WorkerLike {
  postMessage(msg: { id: number; blob: Blob }): void
  addEventListener(type: 'message' | 'error' | 'messageerror', fn: (e: never) => void): void
  removeEventListener(type: 'message' | 'error' | 'messageerror', fn: (e: never) => void): void
  terminate(): void
}

type Reply = { id: number; bitmap?: ImageBitmap; error?: string }
type Pending = { resolve: (b: ImageBitmap) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }

/**
 * Декодер HEIC в воркере. Если воркер упал (например, закончилась память на большом HEIC)
 * или завис, ждущие файлы получают ошибку, воркер убивается, а следующий файл получит новый:
 * иначе одна «плохая» фотография навсегда заблокировала бы всю загрузку.
 */
export function createHeicDecoder(makeWorker: () => WorkerLike, timeoutMs: number) {
  let worker: WorkerLike | null = null
  let seq = 0
  const pending = new Map<number, Pending>()

  function failAll(message: string) {
    const w = worker
    worker = null
    w?.terminate()
    for (const p of pending.values()) {
      clearTimeout(p.timer)
      p.reject(new Error(message))
    }
    pending.clear()
  }

  function ensureWorker(): WorkerLike {
    if (worker) return worker
    const w = makeWorker()
    w.addEventListener('message', ((e: { data: Reply }) => {
      const p = pending.get(e.data.id)
      if (!p) return
      pending.delete(e.data.id)
      clearTimeout(p.timer)
      if (e.data.bitmap) p.resolve(e.data.bitmap)
      else p.reject(new Error(e.data.error ?? 'Не удалось расшифровать HEIC'))
    }) as (e: never) => void)
    const crashed = () => failAll('Декодер HEIC остановился (возможно, не хватило памяти)')
    w.addEventListener('error', crashed)
    w.addEventListener('messageerror', crashed)
    worker = w
    return w
  }

  return function decode(blob: Blob): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      const id = ++seq
      const w = ensureWorker()
      const timer = setTimeout(() => failAll('Превышено время ожидания при расшифровке HEIC (timeout)'), timeoutMs)
      pending.set(id, { resolve, reject, timer })
      w.postMessage({ id, blob })
    })
  }
}
