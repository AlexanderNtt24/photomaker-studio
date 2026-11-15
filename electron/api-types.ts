/** Контракт между интерфейсом и главным процессом (window.api). */
export interface Api {
  platform: string
  loadPresets(): Promise<string>
  savePresets(json: string): Promise<void>
}
