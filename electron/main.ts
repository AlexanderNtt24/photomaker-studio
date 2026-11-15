import { app, BrowserWindow, ipcMain } from 'electron'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

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
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
