import { describe, it, expect } from 'vitest'
import { inflateSync } from 'node:zlib'
import { createCanvas } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import { buildPdf } from '../src/core/export/pdf'
import type { Segment } from '../src/core/collage/marks'

const PT_PER_MM = 72 / 25.4
const portrait = { widthMm: 210, heightMm: 297 }
const landscape = { widthMm: 297, heightMm: 210 }

function image(type: 'jpeg' | 'png'): Uint8Array {
  const c = createCanvas(40, 56)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#6699cc'
  ctx.fillRect(0, 0, 40, 56)
  return new Uint8Array(type === 'jpeg' ? c.toBuffer('image/jpeg') : c.toBuffer('image/png'))
}
const MARKS: Segment[] = Array.from({ length: 8 }, (_, i) => ({ x1: 10 + i * 5, y1: 10, x2: 10 + i * 5, y2: 13 }))

describe('buildPdf', () => {
  it('makes one page of exactly 210x297 mm', async () => {
    const bytes = await buildPdf({ image: image('jpeg'), imageType: 'jpeg', sheetMm: portrait, marks: [] })
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(595.276, 2)
    expect(height).toBeCloseTo(841.89, 2)
    expect(width / PT_PER_MM).toBeCloseTo(210, 2)
    expect(height / PT_PER_MM).toBeCloseTo(297, 2)
  })

  it('landscape swaps the sides', async () => {
    const doc = await PDFDocument.load(await buildPdf({ image: image('jpeg'), imageType: 'jpeg', sheetMm: landscape, marks: [] }))
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(841.89, 2)
    expect(height).toBeCloseTo(595.276, 2)
  })

  it('marks are vector lines added to the page', async () => {
    const plain = await buildPdf({ image: image('jpeg'), imageType: 'jpeg', sheetMm: portrait, marks: [] })
    const marked = await buildPdf({ image: image('jpeg'), imageType: 'jpeg', sheetMm: portrait, marks: MARKS })
    expect(marked.length).toBeGreaterThan(plain.length)
    expect(lineOps(marked)).toBeGreaterThanOrEqual(16) // 8 меток × (подложка + линия)
    expect(lineOps(plain)).toBe(0)
  })

  it('accepts a PNG sheet image too', async () => {
    const bytes = await buildPdf({ image: image('png'), imageType: 'png', sheetMm: portrait, marks: [] })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
})

/** Считает операторы «x y l» в содержимом страницы: сжатые потоки разжимаем, как это сделает просмотрщик. */
function lineOps(bytes: Uint8Array): number {
  const raw = Buffer.from(bytes)
  const text = raw.toString('latin1')
  let count = 0
  for (const m of text.matchAll(/stream\r?\n/g)) {
    const start = m.index! + m[0].length
    const end = text.indexOf('endstream', start)
    let body = raw.subarray(start, end)
    try {
      body = inflateSync(body)
    } catch {
      /* поток не сжат (например, JPEG) — читаем как есть */
    }
    count += (body.toString('latin1').match(/[\d.\-]+ [\d.\-]+ l\b/g) ?? []).length
  }
  return count
}
