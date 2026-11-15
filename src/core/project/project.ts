import { decodeContainer, encodeContainer, ProjectError } from './container'
import { validateCollage } from './validate'
import { isPhoto, isSticker, type Collage } from '../collage/model'

export type ProjectAssetData = { id: string; kind: 'photo' | 'sticker'; name: string; mime: string; data: Uint8Array }
export type ParsedProject = { collage: Collage; assets: ProjectAssetData[]; notes: string[] }

const APP = 'PhotoMaker Studio'
export const MAX_ASSETS = 200

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
export function serializeProject(c: Collage, assets: ProjectAssetData[]): Uint8Array {
  const used = usedAssetIds(c)
  const kept = assets.filter((a) => (a.kind === 'photo' ? used.photos : used.stickers).has(a.id))
  const manifest = {
    app: APP,
    collage: c,
    assets: kept.map((a) => ({ id: a.id, kind: a.kind, name: a.name, mime: a.mime, bytes: a.data.length })),
  }
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
    const data = rest.slice(at, at + a.bytes)
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
