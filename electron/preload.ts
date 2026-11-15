import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from './api-types'

const api: Api = {
  platform: process.platform,
  loadPresets: () => ipcRenderer.invoke('presets:load'),
  savePresets: (json) => ipcRenderer.invoke('presets:save', json),
  savePng: (defaultName, data) => ipcRenderer.invoke('png:save', defaultName, data),
  savePdf: (defaultName, data) => ipcRenderer.invoke('pdf:save', defaultName, data),
  pickBatchFolder: () => ipcRenderer.invoke('png:pick-folder'),
  writeBatchFile: (name, data) => ipcRenderer.invoke('png:write-file', name, data),
}

contextBridge.exposeInMainWorld('api', api)
