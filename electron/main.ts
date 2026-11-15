import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { writeUnique } from './writeUnique'

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
  ipcMain.handle('pdf:save', async (e, defaultName: unknown, data: unknown) => {
    if (typeof defaultName !== 'string' || !(data instanceof Uint8Array)) throw new Error('pdf:save: bad arguments')
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts = { defaultPath: path.basename(defaultName), filters: [{ name: 'PDF', extensions: ['pdf'] }] }
    const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
    if (r.canceled || !r.filePath) return false
    await fs.writeFile(r.filePath, data)
    return true
  })
  // Пакетный экспорт: папку выбирает пользователь один раз, дальше файлы приходят по одному.
  // Путь папки хранится здесь, а не приходит из интерфейса, поэтому писать можно только туда, куда пользователь разрешил.
  let batchFolder: string | null = null
  ipcMain.handle('png:pick-folder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts = { properties: ['openDirectory', 'createDirectory'] as ('openDirectory' | 'createDirectory')[] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    batchFolder = r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0]
    return batchFolder
  })
  ipcMain.handle('png:write-file', async (_e, name: unknown, data: unknown) => {
    if (!batchFolder) throw new Error('Папка для экспорта не выбрана')
    if (typeof name !== 'string' || !(data instanceof Uint8Array)) throw new Error('png:write-file: bad arguments')
    return writeUnique(batchFolder, name, data)
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
