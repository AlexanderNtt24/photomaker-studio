import { parseDecimal } from '../../core/formats'

/** Поле в мм: запятая или точка; вне диапазона — зажимается, мусор и минус — null (поле не меняется). */
export function parseMmField(text: string, min: number, max: number): number | null {
  const v = parseDecimal(text)
  if (!Number.isFinite(v)) return null
  return Math.min(max, Math.max(min, v))
}
