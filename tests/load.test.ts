import { describe, it, expect, vi, afterEach } from 'vitest'
import { isHeic, previewSize, loadImage } from '../src/core/image/load'

describe('isHeic', () => {
  it('detects by extension, case-insensitive', () => {
    expect(isHeic({ name: 'IMG_1.HEIC', type: '' })).toBe(true)
    expect(isHeic({ name: 'a.heif', type: '' })).toBe(true)
  })
  it('detects by mime type', () => {
    expect(isHeic({ name: 'noext', type: 'image/heic' })).toBe(true)
    expect(isHeic({ name: 'noext', type: 'image/heif' })).toBe(true)
  })
  it('is false for other images', () => {
    expect(isHeic({ name: 'a.jpg', type: 'image/jpeg' })).toBe(false)
  })
})

describe('previewSize', () => {
  it('downscales a large landscape photo to the max side', () => {
    expect(previewSize(8000, 6000, 1600)).toEqual({ width: 1600, height: 1200 })
  })
  it('downscales a large portrait photo to the max side', () => {
    expect(previewSize(6000, 8000, 1600)).toEqual({ width: 1200, height: 1600 })
  })
  it('never upscales a small photo', () => {
    expect(previewSize(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
})

describe('loadImage', () => {
  it('reports an empty file as an error instead of throwing', async () => {
    const r = await loadImage(new File([], 'empty.jpg'))
    expect(r).toMatchObject({ ok: false, name: 'empty.jpg' })
  })
  it('reports a non-image file as an error instead of throwing', async () => {
    const r = await loadImage(new File(['это не картинка'], 'broken.jpg', { type: 'image/jpeg' }))
    expect(r).toMatchObject({ ok: false, name: 'broken.jpg' })
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
  })
})

describe('loadImage keeps the original', () => {
  afterEach(() => vi.unstubAllGlobals())
  const stub = () => vi.stubGlobal('createImageBitmap', async () => ({ width: 10, height: 10, close() {} }))

  it('exposes the source file and generates unique ids', async () => {
    stub()
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    const a = await loadImage(file)
    const b = await loadImage(file)
    if (!a.ok || !b.ok) throw new Error('load failed')
    expect(a.image.source).toBe(file)
    expect(a.image.id).not.toBe(b.image.id)
  })
  it('uses the id it is given', async () => {
    stub()
    const r = await loadImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' }), 'fixed')
    expect(r.ok && r.image.id).toBe('fixed')
  })
})
