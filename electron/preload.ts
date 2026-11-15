import { contextBridge } from 'electron'

// Мост между интерфейсом и главным процессом; методы добавляются по мере появления задач.
const api = {
  platform: process.platform,
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
