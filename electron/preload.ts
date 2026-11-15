import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from './api-types'

const api: Api = {
  platform: process.platform,
  loadPresets: () => ipcRenderer.invoke('presets:load'),
  savePresets: (json) => ipcRenderer.invoke('presets:save', json),
}

contextBridge.exposeInMainWorld('api', api)
