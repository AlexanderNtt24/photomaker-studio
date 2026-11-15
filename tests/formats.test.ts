import { describe, it, expect } from 'vitest'
import { PRINT_FORMATS, orientedSizeMm, mmToPx, customFormat } from '../src/core/formats'

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
