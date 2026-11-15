import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHeicDecoder, type WorkerLike } from '../src/core/image/heicDecoder'

class FakeWorker implements WorkerLike {
  private target = new EventTarget()
  posted: { id: number; blob: Blob }[] = []
  terminated = false
  postMessage(msg: { id: number; blob: Blob }) {
    this.posted.push(msg)
  }
  addEventListener(type: string, fn: (e: never) => void) {
    this.target.addEventListener(type, fn as EventListener)
  }
  removeEventListener(type: string, fn: (e: never) => void) {
    this.target.removeEventListener(type, fn as EventListener)
  }
  terminate() {
    this.terminated = true
  }
  emit(type: string, data?: unknown) {
    const e = new Event(type) as Event & { data?: unknown }
    e.data = data
    this.target.dispatchEvent(e)
  }
}

const blob = new Blob(['x'])
afterEach(() => vi.useRealTimers())

describe('createHeicDecoder', () => {
  it('resolves with the bitmap the worker sends back', async () => {
    const w = new FakeWorker()
    const decode = createHeicDecoder(() => w, 1000)
    const p = decode(blob)
    const bmp = { width: 1, height: 1 }
    w.emit('message', { id: w.posted[0].id, bitmap: bmp })
    await expect(p).resolves.toBe(bmp)
  })

  it('rejects with the worker error message', async () => {
    const w = new FakeWorker()
    const p = createHeicDecoder(() => w, 1000)(blob)
    w.emit('message', { id: w.posted[0].id, error: 'HEIF image not found' })
    await expect(p).rejects.toThrow('HEIF image not found')
  })

  it('rejects every waiting file when the worker crashes, and starts a fresh worker next time', async () => {
    const workers: FakeWorker[] = []
    const decode = createHeicDecoder(() => {
      const w = new FakeWorker()
      workers.push(w)
      return w
    }, 1000)
    const a = decode(blob)
    const b = decode(blob)
    workers[0].emit('error')
    await expect(a).rejects.toThrow()
    await expect(b).rejects.toThrow()
    expect(workers[0].terminated).toBe(true)

    const c = decode(blob)
    expect(workers).toHaveLength(2)
    workers[1].emit('message', { id: workers[1].posted[0].id, bitmap: { width: 2, height: 2 } })
    await expect(c).resolves.toMatchObject({ width: 2 })
  })

  it('gives up after the timeout instead of waiting forever, and kills the stuck worker', async () => {
    vi.useFakeTimers()
    const w = new FakeWorker()
    const p = createHeicDecoder(() => w, 5000)(blob)
    const assertion = expect(p).rejects.toThrow(/время|timeout/i)
    await vi.advanceTimersByTimeAsync(5001)
    await assertion
    expect(w.terminated).toBe(true)
  })
})
