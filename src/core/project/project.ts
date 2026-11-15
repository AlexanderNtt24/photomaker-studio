import { decodeContainer, encodeContainer, ProjectError } from './container'
import { MAX_LAYERS, validateCollage } from './validate'
import { isPhoto, isSticker, type Collage } from '../collage/model'
import type { LoadedImage } from '../image/load'
import { checkStoredSticker, useImportedStickers } from '../stickers/imported'

export type ProjectAssetData = { id: string; kind: 'photo' | 'sticker'; name: string; mime: string; data: Uint8Array }
export type ParsedProject = { collage: Collage; assets: ProjectAssetData[]; notes: string[] }

const APP = 'PhotoMaker Studio'
export const MAX_ASSETS = 200
export const MAX_PROJECT_BYTES = 800 * 1024 * 1024
const MAX_MANIFEST_BYTES = 5 * 1024 * 1024

export function usedAssetIds(c: Collage): { photos: Set<string>; stickers: Set<string> } {
  const photos = new Set<string>()
  const stickers = new Set<string>()
  for (const l of c.layers) {
    if (isPhoto(l) && l.imageId) photos.add(l.imageId)
    else if (isSticker(l) && l.source.kind === 'imported') stickers.add(l.source.id)
  }
  return { photos, stickers }
}

/** В файл попадают только те вложения, на которые ссылаются слои. */
export function serializeProject(c: Collage, assets: ProjectAssetData[], limits: { maxBytes: number } = { maxBytes: MAX_PROJECT_BYTES }): Uint8Array {
  const used = usedAssetIds(c)
  const kept = assets.filter((a) => (a.kind === 'photo' ? used.photos : used.stickers).has(a.id))
  const tooBig = (why: string) => new ProjectError(`Проект слишком большой для сохранения: ${why}. Такой файл приложение не сможет открыть.`)
  if (kept.length > MAX_ASSETS) throw tooBig(`вложений больше ${MAX_ASSETS}`)
  if (c.layers.length > MAX_LAYERS) throw tooBig(`слоёв больше ${MAX_LAYERS}`)
  if (kept.reduce((n, a) => n + a.data.length, 0) > limits.maxBytes) throw tooBig(`файл больше ${Math.round(limits.maxBytes / 1048576)} МБ`)
  const manifest = {
    app: APP,
    collage: c,
    assets: kept.map((a) => ({ id: a.id, kind: a.kind, name: a.name, mime: a.mime, bytes: a.data.length })),
  }
  if (JSON.stringify(manifest).length > MAX_MANIFEST_BYTES / 2) throw tooBig('описание слоёв слишком велико')
  return encodeContainer(manifest, kept.map((a) => a.data))
}

const bad = (why: string) => new ProjectError(`Файл проекта повреждён: ${why}.`)

export function parseProject(bytes: Uint8Array): ParsedProject {
  const { manifest, rest } = decodeContainer(bytes)
  if (typeof manifest !== 'object' || manifest === null || (manifest as { app?: unknown }).app !== APP) {
    throw new ProjectError('Это не файл проекта PhotoMaker Studio.')
  }
  const m = manifest as { collage?: unknown; assets?: unknown }
  if (!Array.isArray(m.assets)) throw bad('нет списка вложений')
  if (m.assets.length > MAX_ASSETS) throw bad('слишком много вложений')

  const table = m.assets.map((a: unknown) => {
    const o = (typeof a === 'object' && a !== null ? a : {}) as Record<string, unknown>
    if (typeof o.id !== 'string' || (o.kind !== 'photo' && o.kind !== 'sticker') || typeof o.bytes !== 'number' || !Number.isInteger(o.bytes) || o.bytes < 0) {
      throw bad('описание вложения неверно')
    }
    return { id: o.id.slice(0, 100), kind: o.kind as 'photo' | 'sticker', name: typeof o.name === 'string' ? o.name.slice(0, 200) : '', mime: typeof o.mime === 'string' ? o.mime.slice(0, 100) : '', bytes: o.bytes }
  })
  // Суммы должны сойтись с остатком файла ровно: иначе файл обрезан или подделан.
  const total = table.reduce((n, a) => n + a.bytes, 0)
  if (total !== rest.length) throw bad('размеры вложений не совпадают с размером файла')

  let at = 0
  const assets: ProjectAssetData[] = table.map((a) => {
    const data = rest.subarray(at, at + a.bytes)
    at += a.bytes
    return { id: a.id, kind: a.kind, name: a.name, mime: a.mime, data }
  })

  const { collage, notes } = validateCollage(m.collage)
  const have = { photo: new Set(assets.filter((a) => a.kind === 'photo').map((a) => a.id)), sticker: new Set(assets.filter((a) => a.kind === 'sticker').map((a) => a.id)) }
  const used = usedAssetIds(collage)
  for (const id of used.photos) if (!have.photo.has(id)) notes.push(`В проекте нет файла фото «${id}»: рамка останется пустой.`)
  for (const id of used.stickers) if (!have.sticker.has(id)) notes.push(`В проекте нет файла стикера «${id}».`)
  return { collage, assets, notes }
}

/**
 * Превращает прочитанный проект в готовые к работе данные: декодирует фото, регистрирует стикеры.
 * Фото, которое не прочиталось, не роняет открытие: его рамки становятся пустыми, а в заметках — имя файла.
 */
export async function restoreProject(
  p: ParsedProject,
  decodePhoto: (a: ProjectAssetData) => Promise<LoadedImage | null>,
): Promise<{ collage: Collage; images: LoadedImage[]; notes: string[] }> {
  const notes = [...p.notes]
  const images: LoadedImage[] = []
  const failed = new Set<string>()
  // По одному, чтобы не держать в памяти все оригиналы сразу.
  for (const a of p.assets) {
    if (a.kind === 'sticker') {
      const why = checkStoredSticker(a)
      if (why) notes.push(`Стикер «${a.name || a.id}» не загружен: ${why}.`)
      else useImportedStickers.getState().add({ id: a.id, name: a.name, mime: a.mime, data: a.data })
      continue
    }
    const img = await decodePhoto(a).catch(() => null)
    if (img) images.push(img)
    else {
      failed.add(a.id)
      notes.push(`Не удалось прочитать фото «${a.name || a.id}»: его рамки остались пустыми.`)
    }
  }
  const collage: Collage = {
    ...p.collage,
    layers: p.collage.layers.map((l) => (isPhoto(l) && l.imageId && failed.has(l.imageId) ? { ...l, imageId: null } : l)),
  }
  return { collage, images, notes }
}
