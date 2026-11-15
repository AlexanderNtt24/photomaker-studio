import { describe, it, expect } from 'vitest'
import { parseMmField } from '../src/modes/collage/fields'

describe('parseMmField', () => {
  it('reads a decimal comma', () => expect(parseMmField('5,5', 0, 50)).toBe(5.5))
  it('rejects garbage', () => expect(parseMmField('abc', 0, 50)).toBeNull())
  it('clamps above the maximum', () => expect(parseMmField('99', 0, 50)).toBe(50))
  it('rejects negative input', () => expect(parseMmField('-3', 0, 50)).toBeNull())
  it('clamps below a positive minimum', () => expect(parseMmField('2', 10, 50)).toBe(10))
})
