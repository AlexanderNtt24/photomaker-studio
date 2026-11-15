/** Контракт между интерфейсом и главным процессом (window.api). */
export interface Api {
  platform: string
  loadPresets(): Promise<string>
  savePresets(json: string): Promise<void>
  /** Диалог «Сохранить как…»; true, если файл сохранён. */
  savePng(defaultName: string, data: Uint8Array): Promise<boolean>
  /** Диалог «Сохранить как…» для PDF; true, если файл сохранён. */
  savePdf(defaultName: string, data: Uint8Array): Promise<boolean>
  /**
   * Сохраняет проект. Без `saveAs` перезаписывает файл, выбранный в этой сессии последним
   * (путь хранит главный процесс); если его ещё нет — показывает диалог.
   * Возвращает имя файла или null, если пользователь отказался.
   */
  saveProject(defaultName: string, data: Uint8Array, saveAs: boolean): Promise<string | null>
  /** Диалог «Открыть…» для `.pmstudio`; null — отмена. */
  openProject(): Promise<{ name: string; data: Uint8Array } | null>
  /** Сообщает, есть ли несохранённые изменения: при закрытии окна приложение спросит подтверждение. */
  setDirty(dirty: boolean): void
  /** Диалог выбора папки для пакетного экспорта; null — отмена. */
  pickBatchFolder(): Promise<string | null>
  /** Записывает один файл в выбранную папку, не перезаписывая существующие; возвращает итоговое имя. */
  writeBatchFile(name: string, data: Uint8Array): Promise<string>
}
