import { describe, it, expect } from 'vitest'
import { FONT_FAMILIES, fontCss, wrapText } from '../src/core/collage/fonts'

const measure = (s: string) => s.length * 10 // 10 px на знак

describe('wrapText', () => {
  it('wraps at spaces', () => {
    expect(wrapText('aa bb cc', 50, measure)).toEqual(['aa bb', 'cc'])
  })
  it('keeps explicit line breaks and blank lines', () => {
    expect(wrapText('aa\n\nbb', 100, measure)).toEqual(['aa', '', 'bb'])
  })
  it('breaks a word wider than the box by characters', () => {
    expect(wrapText('abcdefghijkl', 50, measure)).toEqual(['abcde', 'fghij', 'kl'])
  })
  it('handles Cyrillic and emoji without splitting a character', () => {
    expect(wrapText('привет мир', 70, measure)).toEqual(['привет', 'мир'])
    const lines = wrapText('😀😀😀😀😀😀', 30, (s) => Array.from(s).length * 10)
    expect(lines).toEqual(['😀😀😀', '😀😀😀'])
  })
  it('returns nothing for empty or blank text', () => {
    expect(wrapText('', 50, measure)).toEqual([])
    expect(wrapText('   \n  ', 50, measure)).toEqual([])
  })
  it('never loops forever when even one character does not fit', () => {
    expect(wrapText('abc', 0, measure)).toEqual(['a', 'b', 'c'])
  })
})

describe('fontCss', () => {
  it('converts points to pixels for the given scale and quotes the family', () => {
    // 14 pt = 4,939 мм; при 10 px/мм это 49,39 px
    const css = fontCss({ fontFamily: 'Bradley Hand', fontSizePt: 14, bold: false, italic: false }, 10)
    expect(css).toBe('49.39px "Bradley Hand", sans-serif')
  })
  it('adds style and weight', () => {
    expect(fontCss({ fontFamily: 'Georgia', fontSizePt: 10, bold: true, italic: true }, 1)).toMatch(/^italic bold /)
  })
  it('does not let a family name break out of the quotes', () => {
    const css = fontCss({ fontFamily: 'A"; color: red', fontSizePt: 10, bold: false, italic: false }, 1)
    expect(css.match(/"/g)?.length).toBe(2)
  })
})

describe('FONT_FAMILIES', () => {
  it('lists the handwriting fonts first', () => {
    expect(FONT_FAMILIES.slice(0, 3)).toEqual(['Bradley Hand', 'Noteworthy', 'Snell Roundhand'])
  })
})
