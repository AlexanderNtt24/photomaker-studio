import { describe, it, expect } from 'vitest'
import { crc32 } from 'node:zlib'
import { createCanvas } from '@napi-rs/canvas'
import { setPngDpi } from '../src/core/export/png'

function chunks(png: Uint8Array) {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const out: { type: string; data: Uint8Array; crc: number; start: number }[] = []
  let o = 8
  while (o < png.length) {
    const len = dv.getUint32(o)
    const type = String.fromCharCode(...png.slice(o + 4, o + 8))
    out.push({ type, data: png.slice(o + 8, o + 8 + len), crc: dv.getUint32(o + 8 + len), start: o })
    o += 12 + len
  }
  return out
}

const sample = () => new Uint8Array(createCanvas(4, 4).encodeSync('png'))

describe('setPngDpi', () => {
  it('inserts a pHYs chunk right after IHDR with pixels-per-metre for 300 dpi', () => {
    const out = setPngDpi(sample(), 300)
    const cs = chunks(out)
    expect(cs[0].type).toBe('IHDR')
    expect(cs[1].type).toBe('pHYs')
    const dv = new DataView(cs[1].data.buffer, cs[1].data.byteOffset)
    expect(dv.getUint32(0)).toBe(11811)
    expect(dv.getUint32(4)).toBe(11811)
    expect(cs[1].data[8]).toBe(1)
  })

  it('writes a valid CRC and keeps the image data chunks intact', () => {
    const src = sample()
    const out = setPngDpi(src, 300)
    const ph = chunks(out).find((c) => c.type === 'pHYs')!
    const typeAndData = new Uint8Array([...new TextEncoder().encode('pHYs'), ...ph.data])
    expect(ph.crc).toBe(crc32(typeAndData))
    expect(out.length).toBe(src.length + 21)
    expect(chunks(out).filter((c) => c.type === 'IDAT').length).toBe(chunks(src).filter((c) => c.type === 'IDAT').length)
  })

  it('is idempotent: applying twice leaves a single pHYs with the last value', () => {
    const out = setPngDpi(setPngDpi(sample(), 72), 300)
    const ph = chunks(out).filter((c) => c.type === 'pHYs')
    expect(ph).toHaveLength(1)
    expect(new DataView(ph[0].data.buffer, ph[0].data.byteOffset).getUint32(0)).toBe(11811)
  })

  it('rejects data that is not a PNG', () => {
    expect(() => setPngDpi(new Uint8Array([1, 2, 3]), 300)).toThrow()
  })
})
