import { promises as fs } from 'node:fs'
import path from 'node:path'
import { numberedName } from '../src/core/export/filenames'

/**
 * Записывает файл в папку, не перезаписывая существующие: при занятом имени добавляет _2, _3…
 * Флаг `wx` делает проверку и запись одной операцией (без гонки «проверил — записал»).
 * Каталоги из имени отбрасываются, чтобы файл не вышел за пределы выбранной папки.
 */
export async function writeUnique(folder: string, name: string, data: Uint8Array): Promise<string> {
  const base = path.basename(name)
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : numberedName(base, n)
    try {
      await fs.writeFile(path.join(folder, candidate), data, { flag: 'wx' })
      return candidate
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
    }
  }
}
