import { describe, it, expect } from 'vitest'
import { defaultSheet, newPhotoLayer, newTextLayer, newStickerLayer, type Collage } from '../src/core/collage/model'
import { serializeProject, parseProject, usedAssetIds, type ProjectAssetData } from '../src/core/project/project'
import { encodeContainer, ProjectError } from '../src/core/project/container'

const photo = newPhotoLayer({ xMm: 10, yMm: 10, widthMm: 90, heightMm: 130, imageId: 'p1', rotationDeg: 12, frame: { widthMm: 4, color: '#ff0000' } })
const text = newTextLayer({ xMm: 10, yMm: 150, widthMm: 80, heightMm: 20, text: 'Лето 2026' })
const imported = newStickerLayer({ source: { kind: 'imported', id: 's1' }, xMm: 120, yMm: 20, widthMm: 40, heightMm: 40 })
const builtin = newStickerLayer({ source: { kind: 'builtin', id: 'star' }, xMm: 120, yMm: 80, widthMm: 40, heightMm: 40 })
const collage: Collage = { sheet: { ...defaultSheet('album'), background: { type: 'texture', id: 'kraft' } }, layers: [photo, text, imported, builtin] }
const asset = (id: string, kind: 'photo' | 'sticker', data: number[]): ProjectAssetData => ({ id, kind, name: id + '.bin', mime: kind === 'photo' ? 'image/jpeg' : 'image/svg+xml', data: new Uint8Array(data) })
const assets = [asset('p1', 'photo', [1, 2, 3, 4]), asset('s1', 'sticker', [9, 8]), asset('unused', 'photo', [7, 7, 7])]

describe('usedAssetIds', () => {
  it('lists photos and imported stickers that layers refer to', () => {
    const u = usedAssetIds(collage)
    expect([...u.photos]).toEqual(['p1'])
    expect([...u.stickers]).toEqual(['s1'])
  })
})

describe('serializeProject / parseProject', () => {
  it('round-trips the collage and the attachments', () => {
    const r = parseProject(serializeProject(collage, assets))
    expect(r.collage).toEqual(collage)
    expect(r.notes).toEqual([])
    expect(r.assets.map((a) => [a.id, a.kind, Array.from(a.data)])).toEqual([
      ['p1', 'photo', [1, 2, 3, 4]],
      ['s1', 'sticker', [9, 8]],
    ])
  })
  it('does not store a photo that no layer uses', () => {
    expect(parseProject(serializeProject(collage, assets)).assets.some((a) => a.id === 'unused')).toBe(false)
  })
  it('keeps a layer whose attachment is missing and says so', () => {
    const r = parseProject(serializeProject(collage, [assets[1]]))
    expect(r.collage.layers).toHaveLength(4)
    expect(r.notes.join(' ')).toContain('p1')
  })
  it('rejects attachment lengths that do not match the file', () => {
    const data = serializeProject(collage, assets)
    expect(() => parseProject(data.subarray(0, data.length - 2))).toThrow(ProjectError)
  })
  it('rejects a manifest that is not a project', () => {
    expect(() => parseProject(encodeContainer({ hello: 1 }, []))).toThrow(ProjectError)
    expect(() => parseProject(encodeContainer({ app: 'PhotoMaker Studio', collage, assets: 'no' }, []))).toThrow(ProjectError)
  })
  it('rejects absurd attachment tables', () => {
    const table = Array.from({ length: 300 }, (_, i) => ({ id: 'a' + i, kind: 'photo', name: 'x', mime: 'image/png', bytes: 1 }))
    expect(() => parseProject(encodeContainer({ app: 'PhotoMaker Studio', collage, assets: table }, [new Uint8Array(300)]))).toThrow(ProjectError)
    const neg = [{ id: 'a', kind: 'photo', name: 'x', mime: 'image/png', bytes: -5 }]
    expect(() => parseProject(encodeContainer({ app: 'PhotoMaker Studio', collage, assets: neg }, []))).toThrow(ProjectError)
  })
  it('rejects garbage bytes', () => {
    expect(() => parseProject(new Uint8Array([1, 2, 3]))).toThrow(ProjectError)
  })
})
