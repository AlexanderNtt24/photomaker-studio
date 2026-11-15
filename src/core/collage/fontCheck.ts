/**
 * Есть ли шрифт в системе. `document.fonts.check` для неизвестного семейства возвращает true,
 * поэтому сравниваем ширину тестовой строки с запасными семействами: если отличается от обоих, шрифт есть.
 */
export function isFontAvailable(family: string, measure: (font: string) => number): boolean {
  const name = family.replace(/["'\\;{}]/g, '').trim()
  if (!name) return false
  return (['monospace', 'serif', 'sans-serif'] as const).some((fb) => measure(`72px "${name}", ${fb}`) !== measure(`72px ${fb}`))
}

let ctx: CanvasRenderingContext2D | null = null
const SAMPLE = 'mmmmmmmmmmlliWÖжщЯ0123'

/** Вариант для приложения: меряет ширину на невидимом холсте. При сбое считает шрифт доступным (без ложных тревог). */
export function systemFontAvailable(family: string): boolean {
  try {
    ctx ??= document.createElement('canvas').getContext('2d')
    const c = ctx
    if (!c) return true
    return isFontAvailable(family, (font) => {
      c.font = font
      return c.measureText(SAMPLE).width
    })
  } catch {
    return true
  }
}
