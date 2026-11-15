// Собирает build/icon.icns из build/icon.svg. Нужны macOS-утилиты sips и iconutil; ничего не скачивается.
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(path.join(root, 'build/icon.svg'))
const img = await loadImage(svg)
const canvas = createCanvas(1024, 1024)
canvas.getContext('2d').drawImage(img, 0, 0, 1024, 1024)

const tmp = mkdtempSync(path.join(tmpdir(), 'pmicon-'))
const base = path.join(tmp, 'icon-1024.png')
writeFileSync(base, canvas.toBuffer('image/png'))
const set = path.join(tmp, 'icon.iconset')
mkdirSync(set)
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const px = size * scale
    const name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`
    execFileSync('sips', ['-z', String(px), String(px), base, '--out', path.join(set, name)], { stdio: 'ignore' })
  }
}
execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(root, 'build/icon.icns')])
rmSync(tmp, { recursive: true, force: true })
console.log('build/icon.icns готов')
