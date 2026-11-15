export type PrintFormat = { id: string; label: string; widthMm: number; heightMm: number }
export type Orientation = 'portrait' | 'landscape'

const cm = (id: string, label: string, w: number, h: number): PrintFormat => ({
  id,
  label,
  widthMm: w * 10,
  heightMm: h * 10,
})

export const PRINT_FORMATS: PrintFormat[] = [
  cm('9x13', '9×13', 9, 13),
  cm('10x15', '10×15', 10, 15),
  cm('13x18', '13×18', 13, 18),
  cm('15x21', '15×21 (A5)', 15, 21),
  cm('20x30', '20×30', 20, 30),
  cm('21x30', '21×30 (A4)', 21, 30),
  cm('10x10', '10×10', 10, 10),
  cm('3x4', '3×4 (паспорт)', 3, 4),
]

export function orientedSizeMm(
  f: { widthMm: number; heightMm: number },
  o: Orientation,
): { widthMm: number; heightMm: number } {
  const short = Math.min(f.widthMm, f.heightMm)
  const long = Math.max(f.widthMm, f.heightMm)
  return o === 'portrait' ? { widthMm: short, heightMm: long } : { widthMm: long, heightMm: short }
}

export function mmToPx(mm: number, dpi: number): number {
  return Math.round((mm * dpi) / 25.4)
}

const MAX_CUSTOM_MM = 1000

export function customFormat(width: number, height: number, unit: 'mm' | 'cm'): PrintFormat | null {
  const k = unit === 'cm' ? 10 : 1
  const w = width * k
  const h = height * k
  const valid = (v: number) => Number.isFinite(v) && v > 0 && v <= MAX_CUSTOM_MM
  if (!valid(w) || !valid(h)) return null
  return { id: 'custom', label: `${width}×${height} ${unit}`, widthMm: w, heightMm: h }
}
