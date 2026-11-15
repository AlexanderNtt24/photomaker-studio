import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from './api-types'

const api: Api = {
  platform: process.platform,
  loadPresets: () => ipcRenderer.invoke('presets:load'),
  savePresets: (json) => ipcRenderer.invoke('presets:save', json),
  savePng: (defaultName, data) => ipcRenderer.invoke('png:save', defaultName, data),
  savePngBatch: (files) => ipcRenderer.invoke('png:save-batch', files),
}

contextBridge.exposeInMainWorld('api', api)
