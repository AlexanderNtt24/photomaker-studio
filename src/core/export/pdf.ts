import { PDFDocument, rgb } from 'pdf-lib'
import type { Segment } from '../collage/marks'

const PT_PER_MM = 72 / 25.4
const UNDERLAY_PT = 0.6
const MARK_PT = 0.25

export type PdfInput = {
  image: Uint8Array
  imageType: 'jpeg' | 'png'
  sheetMm: { widthMm: number; heightMm: number }
  marks: Segment[]
}

/**
 * Одна страница ровно нужного размера в мм, растр листа на всю страницу,
 * метки обрезки — векторными линиями поверх (белая подложка и чёрная линия).
 */
export async function buildPdf(a: PdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const w = a.sheetMm.widthMm * PT_PER_MM
  const h = a.sheetMm.heightMm * PT_PER_MM
  const page = doc.addPage([w, h])
  const img = a.imageType === 'jpeg' ? await doc.embedJpg(a.image) : await doc.embedPng(a.image)
  page.drawImage(img, { x: 0, y: 0, width: w, height: h })
  const pt = (s: Segment) => ({
    start: { x: s.x1 * PT_PER_MM, y: h - s.y1 * PT_PER_MM },
    end: { x: s.x2 * PT_PER_MM, y: h - s.y2 * PT_PER_MM },
  })
  for (const [thickness, color] of [
    [UNDERLAY_PT, rgb(1, 1, 1)],
    [MARK_PT, rgb(0, 0, 0)],
  ] as const) {
    for (const s of a.marks) page.drawLine({ ...pt(s), thickness, color })
  }
  return doc.save({ useObjectStreams: false })
}
