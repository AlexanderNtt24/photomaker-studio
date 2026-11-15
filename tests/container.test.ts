import { describe, it, expect } from 'vitest'
import { encodeContainer, decodeContainer, ProjectError, FORMAT_VERSION } from '../src/core/project/container'

const bytes = (...n: number[]) => new Uint8Array(n)
const msg = (f: () => unknown) => {
  try {
    f()
  } catch (e) {
    expect(e).toBeInstanceOf(ProjectError)
    return (e as Error).message
  }
  throw new Error('did not throw')
}

describe('container', () => {
  it('round-trips a manifest and attachments', () => {
    const data = encodeContainer({ a: 1, имя: 'ё' }, [bytes(1, 2, 3), bytes(4)])
    const r = decodeContainer(data)
    expect(r.version).toBe(FORMAT_VERSION)
    expect(r.manifest).toEqual({ a: 1, имя: 'ё' })
    expect(Array.from(r.rest)).toEqual([1, 2, 3, 4])
  })
  it('works with no attachments', () => {
    expect(Array.from(decodeContainer(encodeContainer({}, [])).rest)).toEqual([])
  })
  it('rejects foreign and empty files', () => {
    expect(msg(() => decodeContainer(new Uint8Array(0)))).toContain('не файл проекта')
    expect(msg(() => decodeContainer(new TextEncoder().encode('{"hello":"world"} and more')))).toContain('не файл проекта')
  })
  it('rejects a file from a newer version with a clear message', () => {
    const data = encodeContainer({}, [])
    new DataView(data.buffer).setUint32(8, FORMAT_VERSION + 1, true)
    expect(msg(() => decodeContainer(data))).toContain('более новой версии')
  })
  it('rejects a manifest length that runs past the data', () => {
    const data = encodeContainer({ a: 1 }, [])
    new DataView(data.buffer).setUint32(12, 9999, true)
    expect(msg(() => decodeContainer(data))).toContain('повреждён')
  })
  it('rejects a manifest that is not JSON', () => {
    const data = encodeContainer({ a: 1 }, [])
    data[16] = 0x7e // портим первый символ JSON
    expect(msg(() => decodeContainer(data))).toContain('повреждён')
  })
  it('rejects an oversized manifest before parsing it', () => {
    const data = encodeContainer({ big: 'x'.repeat(2000) }, [])
    expect(msg(() => decodeContainer(data, { maxManifestBytes: 100 }))).toContain('слишком большой')
  })
  it('rejects a file cut off in the header', () => {
    const data = encodeContainer({ a: 1 }, [])
    expect(msg(() => decodeContainer(data.slice(0, 11)))).toMatch(/повреждён|не файл проекта/)
  })
})
