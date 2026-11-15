/** Ошибка чтения проекта; сообщение показывается пользователю как есть. */
export class ProjectError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectError'
  }
}

export const FORMAT_VERSION = 1
const MAGIC = new TextEncoder().encode('PMSTUDIO')
const HEADER_BYTES = MAGIC.length + 4 + 4 // сигнатура, версия, длина манифеста
export const DEFAULT_MAX_MANIFEST_BYTES = 5 * 1024 * 1024

/** Сигнатура `PMSTUDIO`, версия `u32`, длина манифеста `u32`, JSON UTF-8, затем вложения подряд. */
export function encodeContainer(manifest: unknown, blobs: Uint8Array[]): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(manifest))
  const total = HEADER_BYTES + json.length + blobs.reduce((n, b) => n + b.length, 0)
  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  out.set(MAGIC, 0)
  dv.setUint32(MAGIC.length, FORMAT_VERSION, true)
  dv.setUint32(MAGIC.length + 4, json.length, true)
  out.set(json, HEADER_BYTES)
  let at = HEADER_BYTES + json.length
  for (const b of blobs) {
    out.set(b, at)
    at += b.length
  }
  return out
}

export function decodeContainer(
  data: Uint8Array,
  limits: { maxManifestBytes: number } = { maxManifestBytes: DEFAULT_MAX_MANIFEST_BYTES },
): { version: number; manifest: unknown; rest: Uint8Array } {
  if (data.length < MAGIC.length || !MAGIC.every((b, i) => data[i] === b)) {
    throw new ProjectError('Это не файл проекта PhotoMaker Studio.')
  }
  if (data.length < HEADER_BYTES) throw new ProjectError('Файл проекта повреждён: он обрезан.')
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const version = dv.getUint32(MAGIC.length, true)
  if (version > FORMAT_VERSION) {
    throw new ProjectError('Проект создан в более новой версии приложения. Обновите PhotoMaker Studio, чтобы его открыть.')
  }
  const manifestLength = dv.getUint32(MAGIC.length + 4, true)
  if (manifestLength > limits.maxManifestBytes) throw new ProjectError('Файл проекта слишком большой или повреждён: описание проекта превышает допустимый размер.')
  if (HEADER_BYTES + manifestLength > data.length) throw new ProjectError('Файл проекта повреждён: описание проекта обрывается.')
  let manifest: unknown
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(HEADER_BYTES, HEADER_BYTES + manifestLength)))
  } catch {
    throw new ProjectError('Файл проекта повреждён: описание проекта нечитаемо.')
  }
  return { version, manifest, rest: data.subarray(HEADER_BYTES + manifestLength) }
}
