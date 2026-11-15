import { describe, it, expect } from 'vitest'
import { exportName, uniqueNames, nextFreeName } from '../src/core/export/filenames'

describe('exportName', () => {
  it('keeps Cyrillic and appends the format', () => {
    expect(exportName('Мой отпуск.HEIC', '10×15')).toBe('Мой отпуск_10x15.png')
  })
  it('replaces characters that are unsafe in file names', () => {
    expect(exportName('a:b.jpg', '9×13')).toBe('a_b_9x13.png')
    expect(exportName('a/b\\c*?"<>|.png', '10×15')).toBe('a_b_c' + '_'.repeat(7) + '10x15.png')
  })
  it('turns spaces in the format into underscores', () => {
    expect(exportName('x.jpg', '12×18 см')).toBe('x_12x18_см.png')
  })
  it('only drops the last extension', () => {
    expect(exportName('my.holiday.photo.jpeg', '10×15')).toBe('my.holiday.photo_10x15.png')
  })
  it('handles a name without extension and an empty name', () => {
    expect(exportName('noext', '10×15')).toBe('noext_10x15.png')
    expect(exportName('.jpg', '10×15')).toBe('photo_10x15.png')
  })
})

describe('uniqueNames', () => {
  it('adds _2, _3 before the extension and keeps order', () => {
    expect(uniqueNames(['a_10x15.png', 'a_10x15.png', 'b.png', 'a_10x15.png'])).toEqual([
      'a_10x15.png',
      'a_10x15_2.png',
      'b.png',
      'a_10x15_3.png',
    ])
  })
  it('treats names that differ only by case as the same file (macOS)', () => {
    expect(uniqueNames(['A.png', 'a.png'])).toEqual(['A.png', 'a_2.png'])
  })
})

describe('nextFreeName', () => {
  it('returns the name itself when it is free', () => {
    expect(nextFreeName('a.png', () => false)).toBe('a.png')
  })
  it('finds the first free numbered name', () => {
    const taken = new Set(['a.png', 'a_2.png'])
    expect(nextFreeName('a.png', (n) => taken.has(n))).toBe('a_3.png')
  })
})
