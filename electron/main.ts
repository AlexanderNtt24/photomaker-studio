import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { nextFreeName } from '../src/core/export/filenames'

const here = path.dirname(fileURLToPath(import.meta.url))
const DEV_URL = 'http://localhost:5173'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'PhotoMaker Studio',
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (app.isPackaged) {
    void win.loadFile(path.join(here, '../dist/index.html'))
  } else {
    void win.loadURL(DEV_URL)
  }
}

const presetsFile = () => path.join(app.getPath('userData'), 'presets.json')

app.whenReady().then(() => {
  ipcMain.handle('presets:load', async () => {
    try {
      return await fs.readFile(presetsFile(), 'utf8')
    } catch {
      return '[]'
    }
  })
  ipcMain.handle('presets:save', async (_e, json: unknown) => {
    if (typeof json !== 'string') throw new Error('presets:save expects a string')
    await fs.mkdir(app.getPath('userData'), { recursive: true })
    await fs.writeFile(presetsFile(), json, 'utf8')
  })
  ipcMain.handle('png:save', async (e, defaultName: unknown, data: unknown) => {
    if (typeof defaultName !== 'string' || !(data instanceof Uint8Array)) throw new Error('png:save: bad arguments')
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts = { defaultPath: path.basename(defaultName), filters: [{ name: 'PNG', extensions: ['png'] }] }
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (r.canceled || !r.filePath) return false
    await fs.writeFile(r.filePath, data)
    return true
  })
  ipcMain.handle('png:save-batch', async (e, files: unknown) => {
    if (!Array.isArray(files)) throw new Error('png:save-batch: bad arguments')
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts = { properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (r.canceled || r.filePaths.length === 0) return null
    const folder = r.filePaths[0]
    let saved = 0
    for (const f of files as { name: string; data: Uint8Array }[]) {
      // Ничего на диске не перезаписываем: при совпадении добавляем _2, _3…
      const name = nextFreeName(path.basename(f.name), (n) => existsSync(path.join(folder, n)))
      await fs.writeFile(path.join(folder, name), f.data)
      saved++
    }
    return { saved, folder }
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
