import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { writeUnique } from '../electron/writeUnique'

let dir: string
beforeEach(async () => {
  // tests/.tmp в .gitignore и в чистой копии репозитория его нет — создаём сами.
  const base = path.join(process.cwd(), 'tests/.tmp')
  await fs.mkdir(base, { recursive: true })
  dir = await fs.mkdtemp(path.join(base, 'wu-'))
})
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

const bytes = (s: string) => new TextEncoder().encode(s)
const read = (n: string) => fs.readFile(path.join(dir, n), 'utf8')

describe('writeUnique', () => {
  it('writes the file under its own name when the folder is empty', async () => {
    expect(await writeUnique(dir, 'a_10x15.png', bytes('one'))).toBe('a_10x15.png')
    expect(await read('a_10x15.png')).toBe('one')
  })

  it('never overwrites a file that is already on disk', async () => {
    await fs.writeFile(path.join(dir, 'a.png'), 'old')
    expect(await writeUnique(dir, 'a.png', bytes('new'))).toBe('a_2.png')
    expect(await read('a.png')).toBe('old')
    expect(await read('a_2.png')).toBe('new')
  })

  it('numbers repeated names 2, 3, ...', async () => {
    await writeUnique(dir, 'a.png', bytes('1'))
    await writeUnique(dir, 'a.png', bytes('2'))
    expect(await writeUnique(dir, 'a.png', bytes('3'))).toBe('a_3.png')
  })

  it('keeps Cyrillic names intact', async () => {
    expect(await writeUnique(dir, 'Мой отпуск_10x15.png', bytes('x'))).toBe('Мой отпуск_10x15.png')
  })

  it('strips directory parts so a name cannot escape the chosen folder', async () => {
    expect(await writeUnique(dir, '../../evil.png', bytes('x'))).toBe('evil.png')
    expect(await read('evil.png')).toBe('x')
  })
})
