/** Контракт между интерфейсом и главным процессом (window.api). */
export interface Api {
  platform: string
  loadPresets(): Promise<string>
  savePresets(json: string): Promise<void>
  /** Диалог «Сохранить как…»; true, если файл сохранён. */
  savePng(defaultName: string, data: Uint8Array): Promise<boolean>
  /** Диалог выбора папки для пакетного экспорта; null — отмена. */
  pickBatchFolder(): Promise<string | null>
  /** Записывает один файл в выбранную папку, не перезаписывая существующие; возвращает итоговое имя. */
  writeBatchFile(name: string, data: Uint8Array): Promise<string>
}
