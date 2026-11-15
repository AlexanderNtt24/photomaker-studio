import { heicTo } from 'heic-to/csp'

type Req = { id: number; blob: Blob }

self.onmessage = async (e: MessageEvent<Req>) => {
  const { id, blob } = e.data
  try {
    const bitmap = await heicTo({ blob, type: 'bitmap' })
    ;(self as unknown as Worker).postMessage({ id, bitmap }, [bitmap])
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
