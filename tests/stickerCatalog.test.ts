import { describe, it, expect } from 'vitest'
import { BUILTIN_STICKERS, builtinById } from '../src/core/stickers/catalog'

describe('built-in stickers', () => {
  it('has at least 12 with unique ids and labels', () => {
    expect(BUILTIN_STICKERS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(BUILTIN_STICKERS.map((s) => s.id)).size).toBe(BUILTIN_STICKERS.length)
    expect(new Set(BUILTIN_STICKERS.map((s) => s.label)).size).toBe(BUILTIN_STICKERS.length)
  })
  it.each(BUILTIN_STICKERS.map((s) => [s.id, s] as const))('%s is a safe, self-contained SVG', (_id, s) => {
    expect(s.svg.startsWith('<svg')).toBe(true)
    expect(s.svg).toMatch(/viewBox="[^"]+"/)
    expect(s.svg).toMatch(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    expect(s.svg).not.toMatch(/<script|onload|onerror|foreignObject|<image|href=/i)
    expect(s.svg.replace('xmlns="http://www.w3.org/2000/svg"', '')).not.toMatch(/http/i)
    expect(s.aspect).toBeGreaterThan(0)
    const [, , w, h] = /viewBox="([\d.\s-]+)"/.exec(s.svg)![1].trim().split(/\s+/).map(Number)
    expect(s.aspect).toBeCloseTo(w / h, 6)
  })
  it('builtinById finds and misses', () => {
    expect(builtinById(BUILTIN_STICKERS[0].id)).toBe(BUILTIN_STICKERS[0])
    expect(builtinById('nope')).toBeUndefined()
  })
})
