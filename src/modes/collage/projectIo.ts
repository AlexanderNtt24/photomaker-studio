import { useCollageStore } from './collageStore'
import { useProjectStore } from './projectStore'
import { useLibraryStore } from '../../core/library/libraryStore'
import { useImportedStickers } from '../../core/stickers/imported'
import { loadImage, type LoadedImage } from '../../core/image/load'
import { ProjectError } from '../../core/project/container'
import { parseProject, restoreProject, serializeProject, usedAssetIds, type ProjectAssetData } from '../../core/project/project'
import type { Api } from '../../../electron/api-types'

export type IoResult = { status: 'saved' | 'opened' | 'cancelled' | 'error'; message?: string; notes?: string[] }

export type IoDeps = {
  api: Pick<Api, 'saveProject' | 'openProject'> | undefined
  confirm: (message: string) => boolean
  decodePhoto: (a: ProjectAssetData) => Promise<LoadedImage | null>
}

const defaultDeps = (): IoDeps => ({
  api: typeof window === 'undefined' ? undefined : window.api,
  confirm: (m) => window.confirm(m),
  async decodePhoto(a) {
    const r = await loadImage(new File([a.data as BlobPart], a.name || a.id, { type: a.mime }), a.id)
    return r.ok ? r.image : null
  },
})

const NO_API = 'Сохранение и открытие проектов доступны только в приложении.'
const describe = (e: unknown) => (e instanceof ProjectError ? e.message : e instanceof Error ? e.message : String(e))

async function collectAssets(): Promise<ProjectAssetData[]> {
  const { collage } = useCollageStore.getState()
  const used = usedAssetIds(collage)
  const assets: ProjectAssetData[] = []
  for (const img of useLibraryStore.getState().images) {
    if (!used.photos.has(img.id)) continue
    assets.push({ id: img.id, kind: 'photo', name: img.name, mime: img.source.type || 'image/jpeg', data: new Uint8Array(await img.source.arrayBuffer()) })
  }
  for (const s of useImportedStickers.getState().items) {
    if (used.stickers.has(s.id)) assets.push({ id: s.id, kind: 'sticker', name: s.name, mime: s.mime, data: s.data })
  }
  return assets
}

export async function saveCurrentProject(saveAs: boolean, deps: IoDeps = defaultDeps()): Promise<IoResult> {
  if (!deps.api) return { status: 'error', message: NO_API }
  try {
    const bytes = serializeProject(useCollageStore.getState().collage, await collectAssets())
    const name = await deps.api.saveProject(useProjectStore.getState().name ?? 'страница.pmstudio', bytes, saveAs)
    if (!name) return { status: 'cancelled' }
    useProjectStore.getState().markSaved(name)
    return { status: 'saved' }
  } catch (e) {
    return { status: 'error', message: 'Не удалось сохранить проект: ' + describe(e) }
  }
}

/** Файл читается и проверяется целиком до того, как что-то в текущей работе меняется. */
export async function openProjectFile(deps: IoDeps = defaultDeps()): Promise<IoResult> {
  if (!deps.api) return { status: 'error', message: NO_API }
  if (useProjectStore.getState().isDirty() && !deps.confirm('В проекте есть несохранённые изменения. Открыть другой проект без сохранения?')) {
    return { status: 'cancelled' }
  }
  try {
    const file = await deps.api.openProject()
    if (!file) return { status: 'cancelled' }
    const restored = await restoreProject(parseProject(file.data), deps.decodePhoto)
    useLibraryStore.getState().addLoaded(restored.images)
    useCollageStore.getState().loadCollage(restored.collage)
    useProjectStore.getState().markSaved(file.name)
    return { status: 'opened', notes: restored.notes }
  } catch (e) {
    return { status: 'error', message: 'Не удалось открыть проект: ' + describe(e) }
  }
}
