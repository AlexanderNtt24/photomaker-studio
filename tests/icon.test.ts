import { describe, it, expect } from 'vitest'
import { readFileSync, statSync } from 'node:fs'

describe('app icon', () => {
  it('icon.icns is a real icns file', () => {
    const b = readFileSync('build/icon.icns')
    expect(b.subarray(0, 4).toString('latin1')).toBe('icns')
    expect(b.readUInt32BE(4)).toBe(b.length) // длина в заголовке совпадает с размером файла
    expect(statSync('build/icon.icns').size).toBeGreaterThan(20_000)
  })
  it('electron-builder uses it', () => {
    expect(readFileSync('electron-builder.yml', 'utf8')).toMatch(/^\s+icon: build\/icon\.icns/m)
  })
  it('icon.svg is a 1024 square without scripts or external references', () => {
    const svg = readFileSync('build/icon.svg', 'utf8').replace('xmlns="http://www.w3.org/2000/svg"', '')
    expect(svg).toContain('viewBox="0 0 1024 1024"')
    expect(svg).not.toMatch(/<script|<foreignObject|https?:\/\//i)
  })
})
