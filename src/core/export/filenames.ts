// eslint-disable-next-line no-control-regex
const UNSAFE = /[/\\:*?"<>|\u0000-\u001f]/g

/** `<имя без расширения>_<формат>.png`; кириллица сохраняется, небезопасные символы → «_». */
export function exportName(originalName: string, formatLabel: string): string {
  const dot = originalName.lastIndexOf('.')
  const stem = dot > 0 ? originalName.slice(0, dot) : dot === 0 ? '' : originalName
  const base = stem.replace(UNSAFE, '_').trim() || 'photo'
  const fmt = formatLabel.replace(/×/g, 'x').replace(/\s+/g, '_').replace(UNSAFE, '_')
  return `${base}_${fmt}.png`
}

/** `a.png` + 2 → `a_2.png` */
export function numberedName(name: string, n: number): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? `${name.slice(0, dot)}_${n}${name.slice(dot)}` : `${name}_${n}`
}

/** Первое свободное имя: `a.png`, `a_2.png`, `a_3.png`… */
export function nextFreeName(name: string, taken: (candidate: string) => boolean): string {
  if (!taken(name)) return name
  for (let n = 2; ; n++) {
    const candidate = numberedName(name, n)
    if (!taken(candidate)) return candidate
  }
}

/** Делает имена в пачке уникальными (без учёта регистра: файловая система macOS не различает её). */
export function uniqueNames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((n) => {
    const free = nextFreeName(n, (c) => used.has(c.toLowerCase()))
    used.add(free.toLowerCase())
    return free
  })
}
