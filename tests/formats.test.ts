import { describe, it, expect } from 'vitest'
import { PRINT_FORMATS, orientedSizeMm, mmToPx, customFormat, parseDecimal, exceedsPixelLimit } from '../src/core/formats'

describe('mmToPx', () => {
  it('converts print sizes at 300 dpi', () => {
    expect(mmToPx(100, 300)).toBe(1181)
    expect(mmToPx(150, 300)).toBe(1772)
    expect(mmToPx(210, 300)).toBe(2480)
    expect(mmToPx(297, 300)).toBe(3508)
  })
})

describe('PRINT_FORMATS', () => {
  it('contains the 8 standard formats, width not greater than height', () => {
    expect(PRINT_FORMATS).toHaveLength(8)
    for (const f of PRINT_FORMATS) expect(f.widthMm).toBeLessThanOrEqual(f.heightMm)
  })
  it('10x15 is 100 x 150 mm', () => {
    const f = PRINT_FORMATS.find((x) => x.id === '10x15')
    expect(f).toMatchObject({ widthMm: 100, heightMm: 150 })
  })
})

describe('orientedSizeMm', () => {
  it('swaps sides for landscape', () => {
    expect(orientedSizeMm({ widthMm: 100, heightMm: 150 }, 'landscape')).toEqual({ widthMm: 150, heightMm: 100 })
    expect(orientedSizeMm({ widthMm: 100, heightMm: 150 }, 'portrait')).toEqual({ widthMm: 100, heightMm: 150 })
  })
  it('puts the shorter side first for portrait even if given swapped', () => {
    expect(orientedSizeMm({ widthMm: 150, heightMm: 100 }, 'portrait')).toEqual({ widthMm: 100, heightMm: 150 })
  })
})

describe('customFormat', () => {
  it('rejects zero, negative, NaN and absurd sizes', () => {
    expect(customFormat(0, 10, 'cm')).toBeNull()
    expect(customFormat(NaN, 10, 'mm')).toBeNull()
    expect(customFormat(-5, 10, 'mm')).toBeNull()
    expect(customFormat(Infinity, 10, 'mm')).toBeNull()
    expect(customFormat(1001, 10, 'mm')).toBeNull()
  })
  it('converts cm to mm', () => {
    expect(customFormat(10, 15, 'cm')).toMatchObject({ widthMm: 100, heightMm: 150 })
  })
})

describe('parseDecimal', () => {
  it('accepts a dot or a comma as the decimal separator', () => {
    expect(parseDecimal('12,5')).toBe(12.5)
    expect(parseDecimal('12.5')).toBe(12.5)
    expect(parseDecimal(' 10 ')).toBe(10)
  })
  it('rejects anything that is not entirely a plain number', () => {
    for (const bad of ['', '10abc', '-5', '1e3', '1,2,3', ',5', 'abc']) expect(parseDecimal(bad)).toBeNaN()
  })
})

describe('exceedsPixelLimit', () => {
  it('allows normal print sizes at 300 dpi', () => {
    expect(exceedsPixelLimit(210, 297, 300)).toBe(false)
    expect(exceedsPixelLimit(210, 297, 600)).toBe(false)
  })
  it('blocks a 100x100 cm print at 300 dpi and A4 at 1200 dpi', () => {
    expect(exceedsPixelLimit(1000, 1000, 300)).toBe(true)
    expect(exceedsPixelLimit(210, 297, 1200)).toBe(true)
  })
  it('blocks a side longer than the canvas limit even if the area is small', () => {
    expect(exceedsPixelLimit(1000, 10, 1200)).toBe(true)
  })
})
