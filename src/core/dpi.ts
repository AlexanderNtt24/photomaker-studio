export type DpiLevel = 'ok' | 'soft' | 'strong'

export function effectiveDpi(sourcePx: number, targetMm: number): number {
  return sourcePx / (targetMm / 25.4)
}

export function dpiLevel(dpi: number): DpiLevel {
  if (dpi < 150) return 'strong'
  if (dpi < 300) return 'soft'
  return 'ok'
}
