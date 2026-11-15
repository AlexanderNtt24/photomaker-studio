import type { TextLayer } from './model'

/** Системные шрифты macOS: рукописные первыми. Ничего не скачивается и не встраивается. */
export const FONT_FAMILIES = [
  'Bradley Hand',
  'Noteworthy',
  'Snell Roundhand',
  'Marker Felt',
  'Chalkboard SE',
  'Helvetica Neue',
  'Georgia',
] as const

const MM_PER_PT = 25.4 / 72
export const LINE_HEIGHT = 1.25

/** Размер шрифта в пикселях холста при заданном масштабе (пикселей в мм). */
export const fontPx = (pt: number, pxPerMm: number): number => pt * MM_PER_PT * pxPerMm

/** Строка для ctx.font. Имя семейства берётся в кавычки; кавычки и обратные косые из имени вычищаются. */
export function fontCss(
  l: Pick<TextLayer, 'fontFamily' | 'fontSizePt' | 'bold' | 'italic'>,
  pxPerMm: number,
): string {
  const family = l.fontFamily.replace(/["'\;{}]/g, '').trim() || 'sans-serif'
  const px = Math.round(fontPx(l.fontSizePt, pxPerMm) * 100) / 100
  return `${l.italic ? 'italic ' : ''}${l.bold ? 'bold ' : ''}${px}px "${family}", sans-serif`
}

/**
 * Перенос по ширине. Режет по пробелам, сохраняет \n и пустые строки; слово шире строки
 * бьётся по символам (не меньше одного символа в строке). Пустой или пробельный текст — [].
 */
export function wrapText(text: string, maxWidthPx: number, measure: (s: string) => number): string[] {
  if (text.trim() === '') return []
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    const flush = () => {
      out.push(line)
      line = ''
    }
    for (const word of para.split(' ')) {
      const cand = line === '' ? word : `${line} ${word}`
      if (measure(cand) <= maxWidthPx) {
        line = cand
        continue
      }
      if (line !== '') flush()
      if (measure(word) <= maxWidthPx) {
        line = word
        continue
      }
      for (const ch of Array.from(word)) {
        if (line !== '' && measure(line + ch) > maxWidthPx) flush()
        line += ch
      }
    }
    out.push(line)
  }
  return out
}
