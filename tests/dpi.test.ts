import { describe, it, expect } from 'vitest'
import { effectiveDpi, dpiLevel } from '../src/core/dpi'

describe('effectiveDpi', () => {
  it('computes pixels per inch over the target width', () => {
    expect(effectiveDpi(1500, 100)).toBeCloseTo(381, 0)
    expect(effectiveDpi(500, 100)).toBeCloseTo(127, 0)
  })
})

describe('dpiLevel', () => {
  it('is ok at 300 and above', () => {
    expect(dpiLevel(381)).toBe('ok')
    expect(dpiLevel(300)).toBe('ok')
  })
  it('is soft from 150 up to just below 300', () => {
    expect(dpiLevel(299.9)).toBe('soft')
    expect(dpiLevel(150)).toBe('soft')
  })
  it('is strong below 150', () => {
    expect(dpiLevel(149.9)).toBe('strong')
  })
  it('flags a small photo for a 10x15 print as strong', () => {
    expect(dpiLevel(effectiveDpi(500, 100))).toBe('strong')
  })
})
