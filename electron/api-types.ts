/** Контракт между интерфейсом и главным процессом (window.api). */
export interface Api {
  platform: string
  loadPresets(): Promise<string>
  savePresets(json: string): Promise<void>
  /** Диалог «Сохранить как…»; true, если файл сохранён. */
  savePng(defaultName: string, data: Uint8Array): Promise<boolean>
  /** Диалог выбора папки; существующие файлы не перезаписываются. null — отмена. */
  savePngBatch(files: { name: string; data: Uint8Array }[]): Promise<{ saved: number; folder: string } | null>
}
