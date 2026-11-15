import { describe, it, expect } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { PDFDocument } from 'pdf-lib'
import { defaultSheet, newPhotoLayer, type Collage } from '../src/core/collage/model'
import type { AssetLookup } from '../src/core/render/renderCollage'
import type { CanvasFactory, RenderSource } from '../src/core/render/renderFit'
import { exportBaseName, renderSheetPng, renderSheetPdf, warningText, canExport, type ExportEnv } from '../src/modes/collage/exportCollage'
import { cropMarkSegments } from '../src/core/collage/marks'
import { collageWarnings, type Warning } from '../src/core/collage/warnings'

const create = ((w: number, h: number) => createCanvas(w, h)) as unknown as CanvasFactory
const env: ExportEnv = {
  create,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encode: async (c: any, mime, quality) => new Uint8Array(mime === 'image/png' ? c.toBuffer('image/png') : c.toBuffer('image/jpeg', Math.round((quality ?? 0.95) * 100))),
}
const solid = (() => {
  const c = createCanvas(40, 40)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#336699'
  ctx.fillRect(0, 0, 40, 40)
  return c as unknown as RenderSource
})()
const assets: AssetLookup = (id) => (id === 'p' ? { full: solid, preview: solid } : undefined)
const sheetWith = (kind: 'album' | 'cut', dpi = 300): Collage => ({
  sheet: { ...defaultSheet(kind), dpi },
  layers: [newPhotoLayer({ xMm: 50, yMm: 50, widthMm: 90, heightMm: 130, imageId: 'p' })],
})

describe('exportBaseName', () => {
  it('names the two sheet kinds', () => {
    expect(exportBaseName('album')).toBe('лист-альбом')
    expect(exportBaseName('cut')).toBe('лист-вырезание')
  })
})

describe('canExport', () => {
  it('refuses an empty collage', () => {
    expect(canExport({ sheet: defaultSheet(), layers: [] })).toEqual(expect.any(String))
    expect(canExport({ sheet: defaultSheet(), layers: [newPhotoLayer({ xMm: 0, yMm: 0, widthMm: 50, heightMm: 50 })] })).toEqual(expect.any(String))
  })
  it('accepts 300 and 600 dpi A4', () => {
    expect(canExport(sheetWith('album', 300))).toBeNull()
    expect(canExport(sheetWith('album', 600))).toBeNull()
  })
  it('refuses a sheet above the pixel limit', () => {
    expect(canExport(sheetWith('album', 3000))).toEqual(expect.any(String))
  })
})

describe('renderSheetPng', () => {
  it('is 2480x3508 with pHYs 11811 px/m', async () => {
    const png = await renderSheetPng(sheetWith('album'), assets, env)
    const dv = new DataView(png.buffer, png.byteOffset)
    expect([dv.getUint32(16), dv.getUint32(20)]).toEqual([2480, 3508])
    expect(String.fromCharCode(...png.slice(37, 41))).toBe('pHYs')
    expect(dv.getUint32(41)).toBe(11811)
  })
})

describe('renderSheetPdf', () => {
  it('is one exact A4 page whose raster has no marks (they are vector)', async () => {
    const c = sheetWith('cut')
    const pdf = await renderSheetPdf(c, assets, env)
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(1)
    const { width, height } = doc.getPage(0).getSize()
    expect(width).toBeCloseTo(595.276, 2)
    expect(height).toBeCloseTo(841.89, 2)

    // растр — встроенный JPEG; метка слева от угла (50,50) мм не должна быть в нём
    const buf = Buffer.from(pdf)
    const start = buf.indexOf(Buffer.from([0xff, 0xd8, 0xff]))
    const end = buf.lastIndexOf(Buffer.from([0xff, 0xd9])) + 2
    const img = await loadImage(buf.subarray(start, end))
    const cv = createCanvas(img.width, img.height)
    const ctx = cv.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const seg = cropMarkSegments(c.layers, { widthMm: 210, heightMm: 297 })[0]
    const px = (mm: number) => Math.round((mm * 300) / 25.4)
    const [r] = ctx.getImageData(px((seg.x1 + seg.x2) / 2), px(seg.y1), 1, 1).data
    expect(r).toBeGreaterThan(240)
  })
})

describe('warningText', () => {
  const kinds: [Warning['kind'], string][] = [
    ['outside', 'Вне поля'],
    ['overlap', 'Пересечение'],
    ['empty', 'Пустая рамка'],
    ['missing', 'Нет фото'],
    ['low-dpi', 'Низкое разрешение'],
  ]
  for (const [kind, name] of kinds) {
    it(`${kind} is named in Russian`, () => {
      expect(warningText({ layerId: 'x', kind, level: 'warn', text: 'пояснение' })).toContain(name)
    })
  }
})

describe('warningText from real warnings', () => {
  it('does not repeat the warning name', () => {
    const c: Collage = { sheet: defaultSheet(), layers: [newPhotoLayer({ xMm: 20, yMm: 20, widthMm: 50, heightMm: 50 }), newPhotoLayer({ xMm: 1, yMm: 1, widthMm: 50, heightMm: 50, imageId: 'gone' })] }
    for (const w of collageWarnings(c, [])) {
      const t = warningText(w)
      const name = t.split(':')[0]
      expect(t.split(name).length - 1, t).toBe(1)
    }
  })
})
