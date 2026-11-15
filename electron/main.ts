import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron'
import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { writeUnique } from './writeUnique'
import { menuTemplate } from './menu'

const here = path.dirname(fileURLToPath(import.meta.url))
const DEV_URL = 'http://localhost:5173'
const MAX_PROJECT_BYTES = 800 * 1024 * 1024
/** Путь проекта, выбранный пользователем в диалоге: интерфейс путей не присылает и писать «куда угодно» не может. */
let projectPath: string | null = null
/** Файл, выбранный в «Открыть…», но ещё не принятый окном: путь для ⌘S становится им только после commitOpen. */
let pendingOpenPath: string | null = null
const dirtyWindows = new Set<number>()

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

  // Закрытие окна с несохранёнными изменениями — только после подтверждения.
  win.on('close', (e) => {
    if (!dirtyWindows.has(win.webContents.id)) return
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      message: 'Есть несохранённые изменения',
      detail: 'Если закрыть окно сейчас, изменения в проекте будут потеряны.',
      buttons: ['Отмена', 'Закрыть без сохранения'],
      defaultId: 0,
      cancelId: 0,
    })
    if (choice === 0) e.preventDefault()
  })
  win.on('closed', () => dirtyWindows.delete(win.webContents.id))

  if (app.isPackaged) {
    void win.loadFile(path.join(here, '../dist/index.html'))
  } else {
    void win.loadURL(DEV_URL)
  }
}

const presetsFile = () => path.join(app.getPath('userData'), 'presets.json')

app.whenReady().then(() => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      menuTemplate((id) => BrowserWindow.getFocusedWindow()?.webContents.send('menu:command', id), {
        isMac: process.platform === 'darwin',
        appName: 'PhotoMaker Studio',
      }),
    ),
  )
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
  ipcMain.on('project:set-dirty', (e, dirty: unknown) => {
    if (typeof dirty !== 'boolean') return
    if (dirty) dirtyWindows.add(e.sender.id)
    else dirtyWindows.delete(e.sender.id)
  })
  ipcMain.handle('project:save', async (e, defaultName: unknown, data: unknown, saveAs: unknown) => {
    if (typeof defaultName !== 'string' || !(data instanceof Uint8Array) || typeof saveAs !== 'boolean') throw new Error('project:save: bad arguments')
    let target = saveAs ? null : projectPath
    if (!target) {
      const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
      const opts = { defaultPath: path.basename(defaultName), filters: [{ name: 'Проект PhotoMaker Studio', extensions: ['pmstudio'] }] }
      const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
      if (r.canceled || !r.filePath) return null
      target = r.filePath.endsWith('.pmstudio') ? r.filePath : r.filePath + '.pmstudio'
    }
    await fs.writeFile(target, data)
    projectPath = target
    return path.basename(target)
  })
  ipcMain.on('project:commit-open', () => {
    if (pendingOpenPath) projectPath = pendingOpenPath
    pendingOpenPath = null
  })
  ipcMain.handle('project:open', async (e) => {
    pendingOpenPath = null
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const opts = { properties: ['openFile' as const], filters: [{ name: 'Проект PhotoMaker Studio', extensions: ['pmstudio'] }] }
    const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (r.canceled || !r.filePaths[0]) return null
    const file = r.filePaths[0]
    const stat = await fs.stat(file)
    if (stat.size > MAX_PROJECT_BYTES) throw new Error('Файл проекта слишком большой.')
    const buf = await fs.readFile(file)
    const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.length)
    pendingOpenPath = file
    return { name: path.basename(file), data }
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
