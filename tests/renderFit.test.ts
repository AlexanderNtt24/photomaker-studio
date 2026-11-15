import { describe, it, expect } from 'vitest'
import { createCanvas } from '@napi-rs/canvas'
import { renderFit, type CanvasFactory, type FitParams } from '../src/core/render/renderFit'
import { NO_EFFECTS } from '../src/core/effects/types'

const create = ((w: number, h: number) => createCanvas(w, h)) as unknown as CanvasFactory

function solid(w: number, h: number, color: string) {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
  return c as unknown as CanvasImageSource & { width: number; height: number }
}

const base: FitParams = {
  widthMm: 100,
  heightMm: 150,
  mode: 'crop',
  crop: { zoom: 1, cx: 0.5, cy: 0.5 },
  marginColor: '#ffffff',
  effects: NO_EFFECTS,
}

function pixel(c: { getContext(t: '2d'): any }, x: number, y: number): number[] {
  return Array.from(c.getContext('2d').getImageData(x, y, 1, 1).data)
}

describe('renderFit size', () => {
  it('renders 10x15 at 300 dpi as 1181 x 1772 px', () => {
    const out = renderFit(solid(3000, 4500, '#336699'), base, 300, create)
    expect([out.width, out.height]).toEqual([1181, 1772])
  })

  it('renders A4 at 300 dpi as 2480 x 3508 px', () => {
    const out = renderFit(solid(3000, 4500, '#336699'), { ...base, widthMm: 210, heightMm: 297 }, 300, create)
    expect([out.width, out.height]).toEqual([2480, 3508])
  })

  it('still renders a tiny photo for a big print without throwing', () => {
    const out = renderFit(solid(500, 750, '#336699'), base, 300, create)
    expect([out.width, out.height]).toEqual([1181, 1772])
  })
})

describe('renderFit modes', () => {
  it('crop fills the whole canvas with the photo', () => {
    const out = renderFit(solid(600, 400, '#0000ff'), base, 25.4, create)
    expect([out.width, out.height]).toEqual([100, 150])
    expect(pixel(out, 0, 0)).toEqual([0, 0, 255, 255])
    expect(pixel(out, 99, 149)).toEqual([0, 0, 255, 255])
  })

  it('contain leaves margin colour around a narrower photo', () => {
    const p: FitParams = { ...base, widthMm: 100, heightMm: 100, mode: 'contain', marginColor: '#00ff00' }
    const out = renderFit(solid(40, 80, '#ff0000'), p, 25.4, create)
    expect(pixel(out, 0, 0)).toEqual([0, 255, 0, 255])
    expect(pixel(out, 50, 50)).toEqual([255, 0, 0, 255])
  })
})
