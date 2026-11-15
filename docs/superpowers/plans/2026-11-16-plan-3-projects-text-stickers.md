# Проекты, текст и стикеры — план реализации (План 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сохранять и открывать страницу коллажа файлом `.pmstudio` с вложенными оригиналами, добавить текстовые слои и стикеры (встроенные и импортированные), не нарушая правил печати Плана 2.

**Architecture:** `Layer` становится объединением `PhotoLayer | TextLayer | StickerLayer` с общим порядком, историей и перетаскиванием. Проект — собственный контейнер (сигнатура, версия, JSON-манифест, байты вложений подряд) без новых зависимостей. Стикеры (SVG/PNG) растеризуются заранее в нужный размер в пикселях, поэтому `renderCollage` остаётся синхронным и общим для предпросмотра и экспорта.

**Tech Stack:** TypeScript, React 19, Zustand 5, Konva, Vitest, `@napi-rs/canvas` (тесты), Electron IPC.

**Spec:** `docs/superpowers/specs/2026-11-15-plan-3-projects-text-stickers-design.md` (дополняет `2026-11-15-photomaker-studio-design.md`).

## Global Constraints

- Единицы модели — миллиметры; `px = мм × dpi / 25,4`; лист только A4 (210×297 мм), dpi листа 150–600.
- Предпросмотр и экспорт — один `renderCollage`; PDF — страница ровно 210×297 мм.
- «Лист для вырезания»: текст и стикеры не рисуются и не экспортируются, но сохраняются в слоях и в проекте.
- Метки обрезки и проверка пересечений — только для фото.
- Проект: формат `PMSTUDIO` версии 1; файл более новой версии отвергается сообщением; битый файл не трогает текущую работу.
- В проект попадают только фото и импортированные стикеры, на которые ссылаются слои; настройки «Подгонки» и пользовательские пресеты — нет.
- Шрифты — только системные macOS, ничего не скачивается и не встраивается; сеть не используется.
- Русский интерфейс; коммиты заканчиваются строкой `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Лимиты: файл проекта до 800 МБ, манифест до 5 МБ, вложений до 200, слоёв до 500, текст до 5000 знаков, импортируемый стикер до 5 МБ и 4096 px по стороне.

## Review Focus

1. Повреждённый, обрезанный, огромный, «из будущей версии» или с вредным манифестом файл проекта: понятное сообщение, текущий лист не меняется (Task 3, 4, 6).
2. В проекте нет байтов фото/стикера или они не декодируются (в том числе HEIC): слой становится пустой рамкой или пропадает с сообщением, приложение не падает (Task 4, 5).
3. Паритет: лист после «сохранить → открыть» рисуется пиксель в пиксель так же, как до сохранения; порядок слоёв, поворот, рамки, эффекты сохранены (Task 4, 5).
4. Текст: пустой, очень длинный, одно слово шире рамки, переводы строк, кириллица, шрифт отсутствует на этом Mac, нулевая и крошечная рамка (Task 7, 8).
5. Импортированный стикер: огромный по пикселям, SVG без `viewBox`, SVG со скриптом, нулевой размер, прозрачность и поворот при экспорте на 600 dpi (Task 10, 11).
6. Несохранённые изменения: закрытие окна, «Открыть…» при правках, возврат undo к сохранённому состоянию снимает пометку (Task 5, 6).

---

## Структура файлов

```
src/core/collage/model.ts          (изм.) TextLayer, StickerLayer, Layer, LayerBox, охранники
src/core/collage/geometry.ts       (изм.) работает с LayerBox
src/core/collage/fonts.ts          список шрифтов, fontCss, wrapText
src/core/project/container.ts      контейнер PMSTUDIO
src/core/project/validate.ts       validateCollage (чистка и ограничение значений)
src/core/project/project.ts        serializeProject, parseProject, restoreProject
src/core/stickers/catalog.ts       встроенные SVG
src/core/stickers/imported.ts      хранилище импортированных, проверка файлов
src/core/stickers/raster.ts        prepareStickers
src/modes/collage/projectStore.ts  имя, путь, пометка «не сохранено»
src/modes/collage/projectIo.ts     сохранить/открыть поверх window.api
src/modes/collage/ProjectBar.tsx, TextInspector.tsx, StickerPanel.tsx, StickerInspector.tsx
electron/main.ts, preload.ts, api-types.ts   project:save / project:open / project:set-dirty
```

---

### Task 1: Исходные байты фото

**Files:** Modify `src/core/image/load.ts`, `tests/load.test.ts` и тестовые помощники `img()` в `tests/*.test.ts`, создающие `LoadedImage`.

**Interfaces:**
- Produces: `LoadedImage.source: Blob` (исходный файл как загружен); `loadImage(file: File, id?: string): Promise<LoadResult>` — `id` по умолчанию `crypto.randomUUID()`.

- [ ] **Step 1: Failing tests** в `tests/load.test.ts` в стиле существующих (подставные `createImageBitmap`): `image.source` — тот же `File`; `loadImage(file, 'fixed')` даёт `id === 'fixed'`; без `id` — непустой уникальный.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3:** добавить поле и параметр; обновить помощники `img()` в тестах (`source: new Blob([])`).
- [ ] **Step 4:** `npm test`, `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(core): keep original file with loaded photo`.

---

### Task 2: Объединение слоёв `Layer` и геометрия по габариту

**Files:** Modify `src/core/collage/model.ts`, `geometry.ts`, `layout.ts`, `warnings.ts`, `marks.ts`, `src/core/render/renderCollage.ts`, `src/modes/collage/{collageStore,CollageStage,Inspector,exportCollage}.ts(x)`; Tests: `tests/collageModel.test.ts`, `tests/collageGeometry.test.ts`, `tests/collageStore.test.ts`, `tests/renderCollage.test.ts`.

**Interfaces:**
- Produces (`model.ts`):
  - `type LayerBox = { xMm: number; yMm: number; widthMm: number; heightMm: number; rotationDeg: number }`
  - `type TextAlign = 'left' | 'center' | 'right'`
  - `type TextLayer = LayerBox & { id: string; type: 'text'; text: string; fontFamily: string; fontSizePt: number; color: string; align: TextAlign; bold: boolean; italic: boolean; opacity: number }`
  - `type StickerSource = { kind: 'builtin'; id: string } | { kind: 'imported'; id: string }`
  - `type StickerLayer = LayerBox & { id: string; type: 'sticker'; source: StickerSource; opacity: number }`
  - `type Layer = PhotoLayer | TextLayer | StickerLayer`; `PhotoLayer` включает `LayerBox`.
  - `isPhoto(l: Layer): l is PhotoLayer`, `isText`, `isSticker`.
  - `newTextLayer(p: Partial<TextLayer> & Pick<TextLayer,'xMm'|'yMm'|'widthMm'|'heightMm'>): TextLayer` — по умолчанию `text: 'Подпись'`, `fontFamily: 'Bradley Hand'`, `fontSizePt: 14`, `color: '#333333'`, `align: 'left'`, `bold/italic: false`, `opacity: 1`, `rotationDeg: 0`, `id: crypto.randomUUID()`.
  - `newStickerLayer(p: Partial<StickerLayer> & Pick<StickerLayer,'source'|'xMm'|'yMm'|'widthMm'|'heightMm'>): StickerLayer` — `opacity: 1`, `rotationDeg: 0`.
- Produces (`geometry.ts`): `corners(l: LayerBox)`, `layerInsideRect(l: LayerBox, r: Rect)`, `clampLayerIntoSheet<T extends LayerBox>(l: T, sheetMm): T`.
- Produces (`collageStore.ts`): `type LayerPatch = Partial<Omit<PhotoLayer,'id'|'type'> & Omit<TextLayer,'id'|'type'> & Omit<StickerLayer,'id'|'type'>>`; `updateLayer(id: string, patch: LayerPatch)` — применяет к слою только поля его вида; минимальный размер 10×10 мм для фото и 5×5 мм для текста и стикеров.

- [ ] **Step 1: Failing tests:** `newTextLayer`/`newStickerLayer` дают значения по умолчанию из Interfaces и уникальные `id`; `isPhoto/isText/isSticker` различают три вида; `corners` и `layerInsideRect` принимают текстовый слой; `clampLayerIntoSheet` сохраняет вид слоя (`type` не теряется); в сторе `applyTemplate('4')` и `fillIdentical` **сохраняют** текстовые и стикерные слои (меняют только фото) и их порядок относительно друг друга; `updateLayer(textId, { widthMm: 2 })` → 5, для фото `{ widthMm: 3 }` → 10, поле чужого вида (`{ frame: … }` для текста) игнорируется; `setOrientation` зажимает в лист слои всех видов; `collageWarnings` даёт `outside` для текстового слоя за полем и **не** считает пересечения текста и стикеров на листе для вырезания; `cropMarkSegments` и `printedLayers` учитывают только фото; `renderCollage` текстовый/стикерный слой пока пропускает (без падения).
- [ ] **Step 2:** запуск → FAIL (и ошибки компиляции).
- [ ] **Step 3: Implement** по Interfaces; в `CollageStage` прямоугольник Konva для любого вида слоя; в `Inspector` для не-фото пока подсказка «Параметры этого слоя — в следующих задачах» (будет заменена в Task 8 и 11).
- [ ] **Step 4:** весь набор и `tsc` зелёные.
- [ ] **Step 5: Commit** — `refactor(collage): layer union with text and sticker layers`.

---

### Task 3: Контейнер проекта

**Files:** Create `src/core/project/container.ts`, `tests/container.test.ts`

**Interfaces:**
- Produces:
  - `class ProjectError extends Error` (сообщение — по-русски, для показа пользователю)
  - `const FORMAT_VERSION = 1`
  - `encodeContainer(manifest: unknown, blobs: Uint8Array[]): Uint8Array` — `PMSTUDIO` (8 байт), версия `u32`, длина манифеста `u32`, JSON UTF-8, затем вложения подряд.
  - `decodeContainer(data: Uint8Array, limits?: { maxManifestBytes: number; maxBlobs: number }): { version: number; manifest: unknown; rest: Uint8Array }` — проверяет сигнатуру, версию (`> FORMAT_VERSION` → «создан в более новой версии»), длины до разбора, валидность JSON; `rest` — всё после манифеста. Лимиты по умолчанию — из Global Constraints.

- [ ] **Step 1: Failing tests:** круг `encode → decode` возвращает манифест и вложения; чужие байты и пустой файл → `ProjectError` («не файл проекта»); версия 2 → «более новой версии»; длина манифеста больше данных → ошибка; манифест не JSON → ошибка; манифест больше лимита → ошибка до разбора; урезанный файл → ошибка, а не исключение другого типа.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `container.ts` (чистые функции, `DataView`, без DOM).
- [ ] **Step 4:** тесты и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(project): PMSTUDIO container format`.

---

### Task 4: Проверка, запись и чтение проекта

**Files:** Create `src/core/project/validate.ts`, `src/core/project/project.ts`, `src/core/stickers/imported.ts` (только хранилище), `tests/projectValidate.test.ts`, `tests/project.test.ts`

**Interfaces:**
- Consumes: `encodeContainer`, `decodeContainer`, `ProjectError` (Task 3); `Layer` и конструкторы (Task 2).
- Produces:
  - `validateCollage(raw: unknown): { collage: Collage; notes: string[] }` — не доверяет ничему: неверные типы и `NaN` у слоя → слой отбрасывается с заметкой; неизвестный `type` → слой отбрасывается; `dpi` зажимается в 150–600, поля и зазор — в 0–30, размеры слоёв ≥ минимума, `opacity` в 0–1, длина текста ≤ 5000, слоёв ≤ 500; лист по умолчанию (`defaultSheet()`), если `sheet` негоден.
  - `type ProjectAssetData = { id: string; kind: 'photo' | 'sticker'; name: string; mime: string; data: Uint8Array }`
  - `usedAssetIds(c: Collage): { photos: Set<string>; stickers: Set<string> }`
  - `serializeProject(c: Collage, assets: ProjectAssetData[]): Uint8Array` — включает только ресурсы, на которые ссылаются слои.
  - `parseProject(bytes: Uint8Array): { collage: Collage; assets: ProjectAssetData[]; notes: string[] }` — сверяет суммы длин вложений с остатком файла.
  - (`imported.ts`) `useImportedStickers`: `items: ImportedSticker[]` (`{ id, name, mime, data: Uint8Array }`), `add(s)`, `byId(id)`, `clear()`.

- [ ] **Step 1: Failing tests:** `validateCollage`: `NaN`/строка вместо числа в слое → слой отброшен и есть заметка; `dpi: 9999` → 600; неизвестный `type: 'video'` → отброшен; текст 6000 знаков → 5000; 600 слоёв → 500; `null` и мусор → лист по умолчанию без слоёв. Проект: круг `serialize → parse` для коллажа с фото, текстом и стикером возвращает тот же `collage` (глубокое равенство) и те же байты вложений; в файл не попадает неиспользуемое фото; манифест с длинами вложений, не сходящимися с остатком файла, → `ProjectError`; ссылка `imageId` на ресурс, которого нет среди вложений, не ломает разбор (слой остаётся, заметка).
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement.** Манифест: `{ app: 'PhotoMaker Studio', collage, assets: [{ id, kind, name, mime, bytes }] }`.
- [ ] **Step 4:** тесты и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(project): validate, serialize and parse projects`.

---

### Task 5: Восстановление проекта, пометка «не сохранено»

**Files:** Modify `src/core/project/project.ts`, `src/modes/collage/collageStore.ts`, `src/core/library/libraryStore.ts` (только новое действие); Create `src/modes/collage/projectStore.ts`, `tests/projectRestore.test.ts`, `tests/projectStore.test.ts`

**Interfaces:**
- Consumes: `loadImage(file, id)` (Task 1), `parseProject`, `useImportedStickers` (Task 4).
- Produces:
  - `restoreProject(p: ParsedProject, decodePhoto: (a: ProjectAssetData) => Promise<LoadedImage | null>): Promise<{ collage: Collage; images: LoadedImage[]; notes: string[] }>` — фото не декодировалось → у слоёв `imageId: null` и заметка с именем файла; стикеры из вложений регистрируются в `useImportedStickers`.
  - `useLibraryStore.addLoaded(images: LoadedImage[]): void` — добавляет готовые фото, не выбирая их.
  - `useCollageStore.loadCollage(c: Collage): void` — заменяет коллаж, сбрасывает историю и выбор.
  - `useProjectStore`: `name: string | null`, `savedCollage: Collage | null`, `markSaved(name: string | null): void` (запоминает текущий `collage` как сохранённый), `isDirty(): boolean` — `collage !== savedCollage` по ссылке (undo к сохранённому снимку возвращает ту же ссылку и снимает пометку), `reset()`.

- [ ] **Step 1: Failing tests:** `restoreProject` с подставным декодером: один из двух файлов не декодируется → его слои `imageId: null`, заметка называет файл, второй слой цел, `id` фото сохранены; стикер из вложений доступен через `useImportedStickers.byId`; **паритет:** коллаж с фото, рамкой, эффектом и поворотом → `serialize → parse → restore` → `renderCollage` обоих (`@napi-rs/canvas`, dpi 25,4) даёт побайтово равные картинки; `loadCollage` обнуляет `canUndo` и выбор; пометка: после `markSaved` `isDirty() === false`, после `updateLayer` — `true`, после `undo` назад к сохранённому — снова `false`; `loadCollage` + `markSaved` — чисто.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** весь набор и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(project): restore projects and track unsaved changes`.

---

### Task 6: Сохранение и открытие в приложении

**Files:** Modify `electron/api-types.ts`, `electron/preload.ts`, `electron/main.ts`, `src/modes/collage/{SheetToolbar,CollageMode}.tsx`; Create `src/modes/collage/projectIo.ts`, `src/modes/collage/ProjectBar.tsx`, `tests/projectIo.test.ts`

**Interfaces:**
- Produces (`api-types.ts`):
  - `saveProject(defaultName: string, data: Uint8Array, saveAs: boolean): Promise<string | null>` — имя сохранённого файла или `null` при отмене; без `saveAs` перезаписывает файл, выбранный в последний раз в этой сессии (путь хранит главный процесс, интерфейс его не передаёт); если пути ещё нет — открывает диалог.
  - `openProject(): Promise<{ name: string; data: Uint8Array } | null>` — диалог «Открыть…» (фильтр `pmstudio`), файл больше 800 МБ отвергается; запоминает путь для «Сохранить».
  - `setDirty(dirty: boolean): void` — интерфейс сообщает признак; главный процесс при закрытии окна с `dirty` показывает диалог «Закрыть без сохранения?» (кнопки «Отмена» по умолчанию и «Закрыть без сохранения»).
- Produces (`projectIo.ts`), все зависимости внедряются параметром `deps` (по умолчанию — `window.api`, `window.confirm`, сторы):
  - `saveCurrentProject(saveAs: boolean, deps?): Promise<'saved' | 'cancelled' | 'error'>`
  - `openProjectFile(deps?): Promise<'opened' | 'cancelled' | 'error'>` — при несохранённых изменениях сначала `confirm`; ошибку разбора показывает сообщением и не трогает текущий лист.
  - Заметки восстановления (`notes`) показываются под панелью.
- `ProjectBar`: кнопки «Открыть…», «Сохранить», «Сохранить как…», имя файла и пометка «• не сохранено»; ⌘S, ⇧⌘S, ⌘O в режиме «Коллаж»; `document.title` = `имя — PhotoMaker Studio` (с «•» при правках); `window.api.setDirty` вызывается при каждом изменении признака.

- [ ] **Step 1: Failing tests** (`projectIo.test.ts`, подставной `api`): «Сохранить как» → `saveProject(…, true)` получает байты, которые `parseProject` читает; успех → `markSaved(имя)` и `isDirty() === false`; отмена диалога (`null`) → пометка остаётся; «Открыть» при `isDirty` и `confirm → false` → `openProject` не вызывается; повреждённые байты → `'error'`, коллаж и история не изменились (Review Focus 1); файл «из будущей версии» → `'error'` с сообщением «более новой версии»; успешное открытие → коллаж заменён, фото добавлены в библиотеку с прежними `id`, пометка снята.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `projectIo.ts`, `ProjectBar.tsx`, IPC (проверка типов аргументов, `path.basename` для имени, расширение `.pmstudio`), закрытие окна в `main.ts`.
- [ ] **Step 4:** тесты, `tsc`, `node scripts/build-electron.mjs` чисто.
- [ ] **Step 5: Commit** — `feat(project): save, open and unsaved-changes guard`.

---

### Task 7: Текст — шрифты, перенос строк, рисование

**Files:** Create `src/core/collage/fonts.ts`, `tests/fonts.test.ts`, `tests/renderText.test.ts`; Modify `src/core/render/renderCollage.ts`

**Interfaces:**
- Produces (`fonts.ts`):
  - `FONT_FAMILIES: string[]` — `Bradley Hand`, `Noteworthy`, `Snell Roundhand`, `Marker Felt`, `Chalkboard SE`, `Helvetica Neue`, `Georgia`.
  - `fontCss(l: Pick<TextLayer,'fontFamily'|'fontSizePt'|'bold'|'italic'>, pxPerMm: number): string` — например `italic bold 56px "Bradley Hand", sans-serif` (размер = `pt × 25,4 / 72 × pxPerMm`).
  - `wrapText(text: string, maxWidthPx: number, measure: (s: string) => number): string[]` — переносы по пробелам; явные `\n` сохраняются; слово шире строки режется по знакам; пустой текст → `[]`.
- Consumes: `TextLayer` (Task 2).
- Рисование в `renderCollage`: только `sheet.kind === 'album'`; слой рисуется в своём порядке, с поворотом вокруг центра и `globalAlpha = opacity`, обрезается по прямоугольнику слоя; строки — высота `1,25 × размер`; выравнивание `left/center/right`; пустой или состоящий из пробелов текст не рисуется.

- [ ] **Step 1: Failing tests:** `wrapText`: «aa bb cc» при ширине на два слова даёт две строки; `\n` даёт отдельную строку; слово из 12 знаков при ширине 5 знаков режется; кириллица и эмодзи не ломают; `''` и `'   '` → `[]`. `fontCss`: строка содержит размер в px для 14 pt при 1 px/мм ≈ `49px`, кавычки вокруг семейства, `italic`/`bold` по флагам. Рендер (`@napi-rs/canvas`, dpi 25,4×): чёрный текст заметно закрашивает пиксели внутри рамки слоя и **не** трогает пиксели за её границей; слишком длинный текст не выходит за рамку; пустой текст оставляет фон; `cut` не рисует текст вовсе; `opacity: 0.5` даёт пиксель светлее, чем `1`; поворот на 90° переносит закрашенную область; слой нулевой высоты (после минимума 5 мм) не падает; метки обрезки текст не учитывают.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** тесты и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(collage): text layers render with wrapping`.

---

### Task 8: Текст — интерфейс и предупреждения

**Files:** Modify `src/modes/collage/{collageStore,SheetToolbar,Inspector,CollageStage,ExportBar}.ts(x)`, `src/core/collage/warnings.ts`, `src/core/collage/model.ts` (вид предупреждения); Create `src/modes/collage/TextInspector.tsx`, `tests/textLayers.test.ts`

**Interfaces:**
- Produces: `addText(): void` — слой 80×20 мм по центру безопасной зоны, выбран; `Warning.kind` дополняется `'font'`; `collageWarnings(c, images, opts?: { fontAvailable?: (family: string) => boolean }): Warning[]` — для текстового слоя с недоступным шрифтом `level: 'warn'`, текст «Шрифта нет на этом компьютере: будет запасной».
- `TextInspector`: поле текста (многострочное), шрифт (`FONT_FAMILIES`), размер pt (4–200), цвет, выравнивание, жирный/курсив, прозрачность, поворот, порядок, «Удалить слой». В `SheetToolbar` кнопка «Добавить текст». Для текста `Transformer` меняет рамку без сохранения пропорций.
- Предупреждение `font` в `ExportBar` использует `document.fonts.check`.

- [ ] **Step 1: Failing tests:** `addText` создаёт текстовый слой внутри `safeRect`, выбирает его; `undo` убирает; `updateLayer(id, { text: 'Привет' })` меняет текст; размер шрифта вне 4–200 зажимается; `NaN` не меняет слой; `collageWarnings` с `fontAvailable: () => false` даёт `font` для текста и не даёт для фото; без `opts` — `font` нет; текстовый слой в кадре, вышедшем за поле, даёт `outside`.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** (UI — без юнит-тестов; приёмка — живая проверка в Task 12).
- [ ] **Step 4:** тесты и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(collage): text layer editing and font warning`.

---

### Task 9: Встроенный набор стикеров

**Files:** Create `src/core/stickers/catalog.ts`, `tests/stickerCatalog.test.ts`

**Interfaces:**
- Produces: `type BuiltinSticker = { id: string; label: string; svg: string; aspect: number }` (`aspect = width / height` из `viewBox`); `BUILTIN_STICKERS: BuiltinSticker[]`; `builtinById(id: string): BuiltinSticker | undefined`.

- [ ] **Step 1: Failing tests:** не меньше 12 стикеров; `id` уникальны; каждый `svg` начинается с `<svg`, имеет `viewBox` и `xmlns`, не содержит `<script`, `onload`, `foreignObject` и внешних ссылок (`http`, кроме `xmlns`); `aspect` > 0 и совпадает с `viewBox`; `builtinById('nope')` → `undefined`.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement:** около 12 простых SVG, нарисованных нами: две полоски скотча, три стрелки, звезда, сердце, ракушка, уголки-рамка, штамп с кругом, облачко, волна. Без чужих материалов.
- [ ] **Step 4:** тесты и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(stickers): built-in sticker set`.

---

### Task 10: Растеризация и рисование стикеров

**Files:** Create `src/core/stickers/raster.ts`, `tests/stickerRender.test.ts`; Modify `src/core/render/renderCollage.ts`, `src/modes/collage/{exportCollage,CollageStage}.ts(x)`, `src/core/collage/warnings.ts`

**Interfaces:**
- Produces (`raster.ts`):
  - `type StickerLookup = (l: StickerLayer) => RenderSource | undefined`
  - `type StickerDecoder = (bytes: Uint8Array, mime: string, widthPx: number, heightPx: number) => Promise<RenderSource>` — в приложении через `Image`/`createImageBitmap`, в тестах через `@napi-rs/canvas`.
  - `MAX_STICKER_SIDE_PX = 8192`
  - `prepareStickers(c: Collage, dpi: number, decode: StickerDecoder, imported: (id: string) => { data: Uint8Array; mime: string } | undefined): Promise<StickerLookup>` — растеризует каждый уникальный стикер в размер `мм × dpi / 25,4` (с потолком по стороне; потерянный импортированный стикер → не попадает в таблицу).
- `RenderOptions` дополняется `stickers?: StickerLookup`. Рисование: только `album`, по порядку слоёв, поворот вокруг центра, `globalAlpha = opacity`; нет растра → слой пропускается. `Warning.kind` дополняется для стикера без источника существующим `'missing'`.
- `exportCollage`: `ExportEnv` получает `decodeSticker: StickerDecoder`; `renderSheetPng/Pdf` перед рендером вызывают `prepareStickers`. `CollageStage` готовит стикеры асинхронно под dpi предпросмотра и перерисовывает лист, когда они готовы.

- [ ] **Step 1: Failing tests:** встроенная звезда, растеризованная в 200×200 px, даёт непрозрачный пиксель в центре и прозрачный в углу; `renderCollage` с `stickers` рисует стикер в ожидаемом прямоугольнике (проба внутри и снаружи); `opacity: 0.5` светлее `1`; поворот на 90° переносит узкий стикер; `cut` стикер не рисует; стикер без растра в таблице пропускается без падения; размер в пикселях больше потолка масштабируется вниз, а не падает (слой 200×200 мм при 600 dpi даёт сторону ≤ `MAX_STICKER_SIDE_PX`); растр на 300 и на 600 dpi — одинаковая форма (центр заполнен в обоих); `collageWarnings` даёт `missing` для импортированного стикера, которого нет.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** весь набор и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(stickers): rasterize and draw sticker layers`.

---

### Task 11: Стикеры — панель, импорт, инспектор

**Files:** Modify `src/core/stickers/imported.ts`, `src/modes/collage/{collageStore,SheetToolbar,Inspector,CollageStage,projectIo}.ts(x)`, `src/core/project/project.ts`; Create `src/modes/collage/{StickerPanel,StickerInspector}.tsx`, `tests/stickerImport.test.ts`

**Interfaces:**
- Produces (`imported.ts`):
  - `validateStickerFile(f: { name: string; type: string; size: number }): string | null` — допускает SVG, PNG, WebP до 5 МБ; иначе сообщение по-русски.
  - `checkSvgText(svg: string): string | null` — отвергает без `<svg`, со `<script`, `foreignObject`, атрибутами `on…=`, пустой.
  - `stickerPixelsOk(width: number, height: number): string | null` — сторона > 4096 или ≤ 0 → сообщение.
  - `importStickerFile(file: File): Promise<{ ok: true; sticker: ImportedSticker } | { ok: false; error: string }>` — читает байты, проверяет, для растров — размеры через `createImageBitmap`, для SVG — отношение сторон из `viewBox` (или `width/height`; без обоих — 1:1), регистрирует в `useImportedStickers`.
  - `addSticker(source: StickerSource, aspect: number): void` в сторе — слой шириной 40 мм по центру безопасной зоны, высота по пропорциям, выбран.
- `StickerPanel`: сетка миниатюр встроенных и импортированных, клик добавляет слой, «Импортировать…» (ошибки — сообщением). `StickerInspector`: прозрачность, поворот, порядок, «Удалить слой»; `Transformer` для стикера с `keepRatio`.
- `serializeProject` берёт байты импортированных стикеров из `useImportedStickers`, `projectIo.openProjectFile` восстанавливает их (через `restoreProject`, Task 5).

- [ ] **Step 1: Failing tests:** `validateStickerFile`: `.png` 1 МБ → `null`, `.exe` → сообщение, SVG 6 МБ → сообщение; `checkSvgText`: обычный SVG → `null`, со `<script>` → сообщение, `<svg onload=…>` → сообщение, пустая строка → сообщение; `stickerPixelsOk(5000, 100)` → сообщение, `(0, 10)` → сообщение, `(100, 100)` → `null`; `importStickerFile` с SVG без `viewBox` и `width/height` принимает файл с `aspect` 1; `addSticker` создаёт слой внутри `safeRect` шириной 40 мм с нужным отношением сторон и выбирает его; сохранение проекта с импортированным стикером и открытие возвращают его байты (Review Focus 5).
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** весь набор и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(stickers): sticker panel, import and inspector`.

---

### Task 12: Сборка, документация, живая проверка

**Files:** Modify `README.md`, `plan.md`

- [ ] **Step 1:** `npm run dist`; ожидается `release/mac-arm64/PhotoMaker Studio.app`.
- [ ] **Step 2:** живая проверка в dev-сервере и в собранном `.app` через CDP: добавить текст (кириллица, длинная строка) и два стикера, импортировать SVG и PNG, проверить на листе и в «листе для вырезания» (текст и стикеры скрыты, слои на месте), экспорт PDF и PNG через `renderSheetPdf/Png` (размер страницы 595,276×841,89, метки есть); сериализовать проект (`serializeProject`) и открыть его (`parseProject` + `restoreProject`) в чистом состоянии, сравнить пиксели листа до и после; повреждённый файл не меняет лист. Системные диалоги «Сохранить как…/Открыть…» и диалог закрытия окна через CDP не вызываются; их проверка вручную автором — отдельно, в итоговом сообщении сказать об этом прямо.
- [ ] **Step 3:** обновить `README.md` (проекты, текст, стикеры, ограничения шрифтов) и `plan.md` (этап 7 выполнен; осталось — полировка: горячие клавиши, иконка).
- [ ] **Step 4:** `npm test` зелёный, `tsc` чисто.
- [ ] **Step 5: Commit** — `chore: build, docs for projects, text and stickers`.

---

## Самопроверка

- **Покрытие дизайна:** проекты — контейнер, проверка, восстановление, пометка и закрытие (Task 3–6); текст (Task 7–8); стикеры встроенные и импорт (Task 9–11); скрытие на листе для вырезания (Task 2, 7, 10); undo/redo — через общий снимок коллажа (Task 2, 5); не-цели (автосохранение, недавние, пакеты стикеров) не реализуются.
- **Согласованность типов:** `LayerBox`, `Layer`, `TextLayer`, `StickerLayer`, `StickerSource`, `ProjectAssetData`, `ParsedProject`, `StickerLookup` определены один раз и используются теми же именами; `updateLayer` принимает `LayerPatch` с Task 2.
- **Review Focus:** шесть пунктов привязаны к задачам с тестами; нативные диалоги — единственное, что не покрывается автоматически и проверяется автором.
- **Пропорции:** тела функций не приведены там, где их определяют сигнатуры и тесты.
