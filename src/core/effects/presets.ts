import { NO_EFFECTS, type EffectParams } from './types'

export type Preset = { id: string; name: string; params: EffectParams; builtin: boolean }

const p = (id: string, name: string, patch: Partial<EffectParams>): Preset => ({
  id: 'builtin-' + id,
  name,
  builtin: true,
  params: { ...NO_EFFECTS, ...patch },
})

export const BUILTIN_PRESETS: Preset[] = [
  p('bw', 'Ч/Б', { grayscale: true, contrast: 10 }),
  p('sepia', 'Сепия', { sepia: true }),
  p('vintage', 'Винтаж', { sepia: true, contrast: -10, saturation: -20, vignette: 40, grain: 25 }),
  p('vivid', 'Яркое', { saturation: 35, contrast: 15, brightness: 5, sharpen: 20 }),
  p('soft', 'Мягкое', { brightness: 8, contrast: -15, blur: 6, vignette: 15 }),
]

const SIGNED = ['brightness', 'contrast', 'saturation'] as const
const UNSIGNED = ['sharpen', 'blur', 'vignette', 'grain'] as const
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Приводит произвольный объект к допустимым EffectParams (диапазоны, типы, недостающие поля). */
function sanitizeParams(raw: unknown): EffectParams | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const out: EffectParams = { ...NO_EFFECTS }
  for (const k of SIGNED) if (typeof r[k] === 'number' && Number.isFinite(r[k])) out[k] = clamp(Math.round(r[k] as number), -100, 100)
  for (const k of UNSIGNED) if (typeof r[k] === 'number' && Number.isFinite(r[k])) out[k] = clamp(Math.round(r[k] as number), 0, 100)
  out.grayscale = r.grayscale === true
  out.sepia = r.sepia === true
  return out
}

/** Терпим к повреждённому файлу: ошибка → [], некорректные записи отбрасываются. */
export function parsePresets(json: string): Preset[] {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: Preset[] = []
  for (const item of data) {
    if (typeof item !== 'object' || item === null) continue
    const { id, name, params } = item as Record<string, unknown>
    if (typeof name !== 'string' || name.trim() === '') continue
    const clean = sanitizeParams(params)
    if (!clean) continue
    out.push({ id: typeof id === 'string' && id ? id : crypto.randomUUID(), name: name.trim(), params: clean, builtin: false })
  }
  return out
}

export function serializePresets(list: Preset[]): string {
  return JSON.stringify(list.filter((x) => !x.builtin).map(({ id, name, params }) => ({ id, name, params })), null, 2)
}
