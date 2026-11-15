# PhotoMaker Studio — План 1: каркас, режим «Подгонка», эффекты (MVP)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Приложение `.app` для macOS, в котором можно загрузить фото (включая HEIC), подогнать под печатный формат (кроп / вписать), применить эффекты и пресеты, увидеть предупреждение о dpi и экспортировать PNG (одно фото или пакет).

**Architecture:** Electron + React/Vite/TS. Единый рендерер на Canvas (`renderFit`) рисует и предпросмотр (с малым dpi), и экспорт (300 dpi) — одна функция, одни пиксели. Чистая логика (форматы, dpi, геометрия, эффекты, история) лежит в `src/core` без зависимости от DOM и покрывается юнит-тестами.

**Tech Stack:** Electron, React, Vite, TypeScript, Vitest, Zustand, `heic-to` (HEIC в воркере), `@napi-rs/canvas` (только в тестах), electron-builder.

**Spec:** `docs/superpowers/specs/2026-11-15-photomaker-studio-design.md` (и `plan.md` в корне).

**Следующие планы (пишутся после завершения этого):** План 2 — режим «Коллаж»: лист A4, шаблоны и свободный макет, рамки внутри размера, два вида листа, PDF и метки обрезки. План 3 — стикеры, текст, проекты `.pmstudio`.

## Global Constraints

- macOS, запуск как `.app` (Electron); Node 26 на машине; Rust не используется.
- Стек: React + Vite + TypeScript, Canvas 2D как единый движок рендера.
- Никаких сетевых запросов во время работы приложения.
- Внутренние единицы — миллиметры; `px = мм × dpi / 25.4`, округление до целого.
- По умолчанию 300 dpi, настраивается.
- Предупреждение по dpi: мягкое при `< 300`, сильное при `< 150`.
- Форматы (см): 9×13, 10×15, 13×18, 15×21, 20×30, 21×30, 10×10, 3×4 + свой размер в см/мм; книжная/альбомная.
- Ввод: JPG, PNG, WebP, HEIC/HEIF; перетаскивание и диалог выбора файла; EXIF-ориентация учитывается.
- Вывод: PNG в sRGB; имена пакетного экспорта `<имя>_<формат>.png`.
- Интерфейс на русском, тема по `prefers-color-scheme`, минималистичный.
- Undo/redo обязательны.
- Отдельный git-репозиторий внутри `PhotoMaker Studio` (корень git по умолчанию — домашняя папка, это нельзя использовать).
- Сообщения коммитов заканчиваются строкой `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Входы, которые спека подразумевает, но задачи не вытекают из них напрямую; тест для каждого — в указанной задаче.

1. Фото меньше целевого размера (сильное увеличение): сильное dpi-предупреждение, без падения (Task 3, 7).
2. Портретное фото с iPhone с EXIF-поворотом: в предпросмотре и экспорте стоит правильно (Task 4).
3. Битый, пустой или неподдерживаемый файл при загрузке: сообщение об ошибке, остальные файлы грузятся (Task 4, 5).
4. Очень большое фото (например 8000×6000): предпросмотр не вешает интерфейс, использует уменьшенную копию (Task 4, 7).
5. Пакетный экспорт с одинаковыми именами файлов (`IMG.jpg` из двух папок) и кириллицей в имени: ничего не перезаписывается (Task 11).

---

## Структура файлов

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, electron-builder.yml
electron/main.ts            окно, IPC (диалоги, чтение/запись файлов, userData)
electron/preload.ts         безопасный мост window.api
src/main.tsx, src/app/App.tsx, src/app/theme.css
src/core/formats.ts         форматы и мм↔px
src/core/dpi.ts             эффективный dpi и уровень предупреждения
src/core/fit/geometry.ts    расчёт кропа и вписывания
src/core/image/load.ts      загрузка, EXIF, HEIC, превью-копия
src/core/image/heic.worker.ts
src/core/render/renderFit.ts
src/core/effects/{types,apply,presets}.ts
src/core/history/history.ts
src/core/export/filenames.ts
src/modes/fit/{FitMode.tsx,fitStore.ts,CropStage.tsx,Controls.tsx,Thumbs.tsx}
tests/ ... (по одному файлу на модуль core)
references/                 IMG_9334.jpg, IMG_9335.jpg (в .gitignore)
```

---

### Task 1: Каркас, git, запуск окна

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `electron/main.ts`, `electron/preload.ts`, `src/main.tsx`, `src/app/App.tsx`, `tests/smoke.test.ts`
- Move: `IMG_9334.jpg`, `IMG_9335.jpg` → `references/`

**Interfaces:**
- Produces: скрипты `npm run dev` (Vite + Electron), `npm test` (Vitest), `npm run build`. `window.api` объявлен в `electron/preload.ts` (расширяется в Task 10, 11).

- [ ] **Step 1:** В `PhotoMaker Studio` выполнить `git init`, проверить `git rev-parse --show-toplevel` → путь папки проекта (не домашняя). Создать `.gitignore` (`node_modules`, `dist`, `release`, `*.app`, `.DS_Store`, `references/`). Перенести два фото в `references/`.
- [ ] **Step 2: Failing test** `tests/smoke.test.ts`: `expect(1 + 1).toBe(2)`; запустить `npx vitest run` до настройки → FAIL (нет конфигурации).
- [ ] **Step 3:** Настроить Vite + React + TS, Vitest (среда `node`), Electron (`main.ts` открывает окно с `index.html`, `contextIsolation: true`, без `nodeIntegration`; CSP запрещает внешние источники).
- [ ] **Step 4:** `npm test` → PASS; `npm run dev` показывает окно с текстом «PhotoMaker Studio».
- [ ] **Step 5: Commit** — `chore: project scaffold with Electron, React, Vite, Vitest`.

---

### Task 2: Форматы печати и мм↔px

**Files:** Create `src/core/formats.ts`, Test `tests/formats.test.ts`

**Interfaces:**
- Produces:
  - `type PrintFormat = { id: string; label: string; widthMm: number; heightMm: number }`
  - `const PRINT_FORMATS: PrintFormat[]` — 8 форматов из Global Constraints, ширина меньше высоты (книжная ориентация по умолчанию).
  - `type Orientation = 'portrait' | 'landscape'`
  - `orientedSizeMm(f: {widthMm:number;heightMm:number}, o: Orientation): {widthMm:number;heightMm:number}`
  - `mmToPx(mm: number, dpi: number): number` (округление `Math.round`)
  - `customFormat(width: number, height: number, unit: 'mm'|'cm'): PrintFormat | null` — `null`, если значение не конечное число, ≤ 0 или > 1000 мм.

- [ ] **Step 1: Failing tests:** `mmToPx(100, 300)` = 1181, `mmToPx(150, 300)` = 1772, `mmToPx(210, 300)` = 2480, `mmToPx(297, 300)` = 3508; `PRINT_FORMATS` содержит ровно 8 элементов, `10x15` = 100×150 мм; `orientedSizeMm` для landscape меняет стороны; `customFormat(0, 10, 'cm')`, `customFormat(NaN, 10, 'mm')`, `customFormat(-5, 10, 'mm')` → `null`; `customFormat(10, 15, 'cm')` → 100×150 мм.
- [ ] **Step 2:** `npx vitest run tests/formats.test.ts` → FAIL.
- [ ] **Step 3:** Реализовать в `src/core/formats.ts`.
- [ ] **Step 4:** тесты → PASS.
- [ ] **Step 5: Commit** — `feat(core): print formats and mm/px conversion`.

---

### Task 3: Эффективный dpi и предупреждение

**Files:** Create `src/core/dpi.ts`, Test `tests/dpi.test.ts`

**Interfaces:**
- Consumes: ничего.
- Produces:
  - `effectiveDpi(sourcePx: number, targetMm: number): number` — `sourcePx / (targetMm / 25.4)`.
  - `type DpiLevel = 'ok' | 'soft' | 'strong'`
  - `dpiLevel(dpi: number): DpiLevel` — `< 150` → `strong`, `< 300` → `soft`, иначе `ok`.

- [ ] **Step 1: Failing tests:** `effectiveDpi(1500, 100)` ≈ 381; `dpiLevel(381)` = `ok`; `dpiLevel(300)` = `ok`; `dpiLevel(299.9)` = `soft`; `dpiLevel(150)` = `soft`; `dpiLevel(149.9)` = `strong`; `effectiveDpi(500, 100)` ≈ 127 → `strong` (Review Focus 1).
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5: Commit** — `feat(core): effective dpi and warning levels`.

---

### Task 4: Загрузка изображений (EXIF, HEIC, превью-копия)

**Files:** Create `src/core/image/load.ts`, `src/core/image/heic.worker.ts`, Test `tests/load.test.ts`

**Interfaces:**
- Produces:
  - `type LoadedImage = { id: string; name: string; width: number; height: number; full: ImageBitmap; preview: ImageBitmap }` — `width/height` уже с учётом EXIF-ориентации; `preview` имеет длинную сторону ≤ 1600 px.
  - `type LoadResult = { ok: true; image: LoadedImage } | { ok: false; name: string; error: string }`
  - `isHeic(file: { name: string; type: string }): boolean` — по расширению `.heic/.heif` или типу `image/heic|heif`.
  - `previewSize(w: number, h: number, maxSide: number): { width: number; height: number }`
  - `loadImage(file: File): Promise<LoadResult>` — не выбрасывает исключений; HEIC декодируется в воркере через `heic-to`; остальные через `createImageBitmap(file, { imageOrientation: 'from-image' })`.

- [ ] **Step 1: Failing tests** (чистые функции): `isHeic({name:'IMG_1.HEIC',type:''})` = true; `isHeic({name:'a.jpg',type:'image/jpeg'})` = false; `previewSize(8000, 6000, 1600)` = 1600×1200 (Review Focus 4); `previewSize(800, 600, 1600)` = 800×600 без увеличения; `previewSize(6000, 8000, 1600)` = 1200×1600.
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5:** Проверка вручную (результат в заметках коммита): JPG и HEIC с iPhone в портретной ориентации загружаются стоящими правильно; текстовый файл с расширением `.jpg` возвращает `{ ok:false }`, а не падает (Review Focus 2, 3).
- [ ] **Step 6: Commit** — `feat(core): image loading with EXIF, HEIC worker, preview copy`.

---

### Task 5: Загрузка в интерфейсе (перетаскивание, диалог, список)

**Files:** Create `src/modes/fit/fitStore.ts`, `src/modes/fit/Thumbs.tsx`, `src/modes/fit/FitMode.tsx`; Modify `src/app/App.tsx`, `electron/main.ts`, `electron/preload.ts`; Test `tests/fitStore.test.ts`

**Interfaces:**
- Consumes: `loadImage`, `LoadResult` (Task 4).
- Produces: Zustand-хранилище `useFitStore`:
  - состояние: `images: LoadedImage[]`, `selectedId: string | null`, `errors: {name:string;error:string}[]`
  - `addFiles(files: File[]): Promise<void>` — добавляет успешные, ошибки кладёт в `errors`, не прерывается на первой ошибке
  - `select(id: string): void`, `remove(id: string): void`, `clearErrors(): void`
  - `window.api.openFiles(): Promise<File[]>` через диалог выбора (расширения: jpg, jpeg, png, webp, heic, heif).

- [ ] **Step 1: Failing tests:** `addFiles` с двумя файлами (первый битый) → `images.length` = 1, `errors.length` = 1, выбран загруженный (мок `loadImage`); `remove` выбранного → выбор переходит на соседнее или `null`.
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5:** UI: область перетаскивания на всё окно + кнопка «Выбрать файлы…», ряд миниатюр, ошибки показываются списком над миниатюрами с кнопкой «Закрыть». Ручная проверка: перетащить два файла из `references/`.
- [ ] **Step 6: Commit** — `feat(fit): drag-and-drop and file picker with thumbnails`.

---

### Task 6: Геометрия кропа и вписывания

**Files:** Create `src/core/fit/geometry.ts`, Test `tests/geometry.test.ts`

**Interfaces:**
- Produces:
  - `type Rect = { x: number; y: number; width: number; height: number }`
  - `type CropState = { zoom: number; cx: number; cy: number }` — `zoom ≥ 1` (1 = вписанная в кадр максимальная область), `cx, cy` — центр в долях 0..1 от размеров изображения.
  - `cropRect(imgW: number, imgH: number, targetRatio: number, s: CropState): Rect` — рамка нужного соотношения `width/height`, целиком внутри изображения (центр зажимается так, чтобы рамка не выходила за края).
  - `containRect(imgW: number, imgH: number, boxW: number, boxH: number): Rect` — вписать целиком по центру коробки.

- [ ] **Step 1: Failing tests:** для изображения 6000×4000 и `targetRatio` 2/3 при `zoom` 1 рамка 2667×4000 (±1 px) по центру; при `cx = 0` рамка прижата к левому краю (`x = 0`); `zoom` 2 → ширина вдвое меньше; `containRect(4000, 6000, 1000, 1000)` → 667×1000 по центру (`x ≈ 167`); `zoom` < 1 приводится к 1.
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5: Commit** — `feat(core): crop and contain geometry`.

---

### Task 7: Единый рендерер `renderFit`

**Files:** Create `src/core/render/renderFit.ts`, Test `tests/renderFit.test.ts`

**Interfaces:**
- Consumes: `cropRect`, `containRect` (Task 6), `mmToPx` (Task 2), `applyEffects` (Task 9 — до его готовности параметр `effects` игнорируется).
- Produces:
  - `type FitParams = { widthMm: number; heightMm: number; mode: 'crop' | 'contain'; crop: CropState; marginColor: string; effects: EffectParams }`
  - `type CanvasFactory = (w: number, h: number) => CanvasLike`, где `CanvasLike` имеет `getContext('2d')` и `width/height`
  - `renderFit(source: CanvasImageSource & { width: number; height: number }, p: FitParams, dpi: number, create: CanvasFactory): CanvasLike` — результат ровно `mmToPx(widthMm, dpi) × mmToPx(heightMm, dpi)`.
  - Для предпросмотра UI вызывает `renderFit` с `preview` и малым dpi, для экспорта — с `full` и 300 dpi.

- [ ] **Step 1: Failing tests** (`@napi-rs/canvas` как фабрика): размер результата для 10×15 при 300 dpi = 1181×1772; для A4 = 2480×3508; режим `contain` на квадратном холсте даёт цвет `marginColor` в угловом пикселе; фото 500×750 px под 10×15 см (Review Focus 1) рендерится без исключения и возвращает холст правильного размера.
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5: Commit** — `feat(core): shared renderFit used by preview and export`.

---

### Task 8: Интерфейс режима «Подгонка»

**Files:** Create `src/modes/fit/Controls.tsx`, `src/modes/fit/CropStage.tsx`; Modify `src/modes/fit/fitStore.ts`, `src/modes/fit/FitMode.tsx`; Test `tests/fitStoreParams.test.ts`

**Interfaces:**
- Consumes: `PRINT_FORMATS`, `orientedSizeMm`, `customFormat` (Task 2), `effectiveDpi`, `dpiLevel` (Task 3), `CropState` (Task 6), `renderFit` (Task 7).
- Produces: в `useFitStore` добавляются
  - `formatId: string`, `orientation: Orientation`, `custom: { width: string; height: string; unit: 'mm'|'cm' } | null`, `mode: 'crop'|'contain'`, `dpi: number` (по умолчанию 300), `marginColor: string` (по умолчанию `#ffffff`), `cropById: Record<string, CropState>`
  - селектор `targetSizeMm(): { widthMm: number; heightMm: number } | null`
  - селектор `dpiInfo(): { dpi: number; level: DpiLevel } | null` — по реальному размеру кропа в пикселях полного изображения и ширине цели в мм (берётся меньшее из значений по двум сторонам).

- [ ] **Step 1: Failing tests:** при формате 10×15, портрет, `targetSizeMm()` = 100×150; при `orientation: 'landscape'` — 150×100; неверный `custom` (ноль) → `null`; для фото 1000×1500 px и формата 10×15 `dpiInfo().level` = `soft` (254 dpi); для 500×750 px — `strong`.
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5:** UI: выпадающий список форматов, переключатель ориентации, поля «свой размер» с выбором мм/см и подсказкой при неверном вводе, переключатель «Кроп / Вписать», выбор цвета полей, поле dpi. `CropStage` показывает предпросмотр через `renderFit(preview, …, 96 dpi)`, перетаскивание двигает `cx, cy`, колесо/ползунок меняет `zoom`. Бейдж dpi: жёлтый для `soft`, красный для `strong` с текстом «Мало пикселей для печати в этом размере».
- [ ] **Step 6: Commit** — `feat(fit): format, orientation, crop/contain controls with dpi badge`.

---

### Task 9: Эффекты

**Files:** Create `src/core/effects/types.ts`, `src/core/effects/apply.ts`, Test `tests/effects.test.ts`; Modify `src/core/render/renderFit.ts`

**Interfaces:**
- Produces:
  - `type EffectParams = { brightness: number; contrast: number; saturation: number; sharpen: number; blur: number; vignette: number; grain: number; grayscale: boolean; sepia: boolean }` — числовые поля `brightness/contrast/saturation` в диапазоне −100..100, `sharpen/blur/vignette/grain` в 0..100.
  - `const NO_EFFECTS: EffectParams` (нули и `false`)
  - `applyEffects(img: ImageData, p: EffectParams, seed?: number): ImageData` — чистая функция по пикселям (без CSS-фильтров), `seed` делает зерно воспроизводимым; при `NO_EFFECTS` возвращает данные без изменений.
  - `renderFit` вызывает `applyEffects` по готовому холсту.

- [ ] **Step 1: Failing tests (1×1 и 2×2 ImageData):** `NO_EFFECTS` оставляет пиксель `(200,100,50)` как есть; `grayscale` даёт `r=g=b=round(0.2126*200+0.7152*100+0.0722*50)` = 118; `brightness: 100` не выходит за 255; `brightness: -100` на `(10,10,10)` даёт `(0,0,0)`; `sepia` у серого пикселя даёт `r > g > b`; два вызова с одним `seed` и `grain: 50` дают одинаковый результат; alpha не меняется.
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5:** Добавить в `Controls.tsx` ползунки эффектов и переключатели «Ч/Б», «Сепия»; параметры хранятся по фото (`effectsById` в `fitStore`).
- [ ] **Step 6: Commit** — `feat(core): per-pixel effects shared by preview and export`.

---

### Task 10: Пресеты (встроенные и свои)

**Files:** Create `src/core/effects/presets.ts`, Test `tests/presets.test.ts`; Modify `electron/main.ts`, `electron/preload.ts`

**Interfaces:**
- Consumes: `EffectParams`, `NO_EFFECTS` (Task 9).
- Produces:
  - `type Preset = { id: string; name: string; params: EffectParams; builtin: boolean }`
  - `const BUILTIN_PRESETS: Preset[]` — «Ч/Б», «Сепия», «Винтаж», «Яркое», «Мягкое».
  - `parsePresets(json: string): Preset[]` — терпимо к повреждённому файлу: при ошибке возвращает `[]`, отбрасывает некорректные записи.
  - `serializePresets(list: Preset[]): string` — сохраняются только `builtin: false`.
  - `window.api.loadPresets(): Promise<string>` и `window.api.savePresets(json: string): Promise<void>` — файл `presets.json` в `app.getPath('userData')`.

- [ ] **Step 1: Failing tests:** `parsePresets('не json')` = `[]`; `serializePresets` не включает встроенные; цикл `parsePresets(serializePresets(x))` возвращает те же пользовательские пресеты; запись без `name` отбрасывается.
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5:** UI: выпадающий список пресетов, кнопки «Сохранить как пресет…» и «Удалить» (только для своих).
- [ ] **Step 6: Commit** — `feat(fit): built-in and user effect presets`.

---

### Task 11: Экспорт PNG, пакетный режим, имена файлов

**Files:** Create `src/core/export/filenames.ts`, Test `tests/filenames.test.ts`; Modify `src/modes/fit/FitMode.tsx`, `electron/main.ts`, `electron/preload.ts`

**Interfaces:**
- Produces:
  - `exportName(originalName: string, formatLabel: string): string` — `<имя без расширения>_<формат>.png`; в формате пробелы и `×` заменяются на `x` (`10×15` → `10x15`), недопустимые для файла символы `/ \ : * ? " < > |` в имени заменяются на `_`; кириллица сохраняется.
  - `uniqueNames(names: string[]): string[]` — при совпадении добавляет `_2`, `_3`… перед расширением, порядок сохраняется (Review Focus 5).
  - `window.api.savePng(defaultName: string, data: Uint8Array): Promise<boolean>` — диалог «Сохранить как…».
  - `window.api.savePngBatch(files: { name: string; data: Uint8Array }[]): Promise<{ saved: number; folder: string } | null>` — диалог выбора папки; существующие файлы на диске не перезаписываются (добавляется `_2`).

- [ ] **Step 1: Failing tests:** `exportName('Мой отпуск.HEIC', '10×15')` = `Мой отпуск_10x15.png`; `exportName('a:b.jpg', '9×13')` = `a_b_9x13.png`; `uniqueNames(['a_10x15.png','a_10x15.png','b.png'])` = `['a_10x15.png','a_10x15_2.png','b.png']`.
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5:** Кнопки «Экспорт PNG» (текущее фото) и «Экспорт всех» (все загруженные с текущими настройками формата, а кроп и эффекты у каждого свои). Экспорт: `renderFit(full, …, dpi)` → PNG через `canvas.toBlob`. Ручная проверка: экспортированный файл 10×15 имеет 1181×1772 px.
- [ ] **Step 6: Commit** — `feat(fit): PNG export and batch export with safe file names`.

---

### Task 12: Undo/redo

**Files:** Create `src/core/history/history.ts`, Test `tests/history.test.ts`; Modify `src/modes/fit/fitStore.ts`, `src/app/App.tsx`

**Interfaces:**
- Produces:
  - `class History<T>` с `constructor(initial: T, limit = 100)`, `push(state: T): void`, `undo(): T | null`, `redo(): T | null`, `get current(): T`, `get canUndo(): boolean`, `get canRedo(): boolean`; `push` после `undo` отбрасывает «будущее»; сверх `limit` самые старые записи удаляются.
  - Отслеживаемое состояние в `fitStore`: `formatId`, `orientation`, `custom`, `mode`, `marginColor`, `cropById`, `effectsById`. Перетаскивание/ползунок записываются в историю по окончании жеста, а не на каждый кадр.
  - Горячие клавиши ⌘Z и ⇧⌘Z; кнопки «Отменить»/«Повторить» в панели.

- [ ] **Step 1: Failing tests:** push 1,2,3 → undo → 2 → undo → 1 → redo → 2; push после undo сбрасывает redo; `limit = 3` и 5 push → `canUndo` ровно 2 раза; `undo` на начальном состоянии возвращает `null`.
- [ ] **Step 2–4:** FAIL → реализовать → PASS.
- [ ] **Step 5:** Подключить к `fitStore`; ручная проверка: сменить формат, подвигать кроп, нажать ⌘Z несколько раз.
- [ ] **Step 6: Commit** — `feat(fit): undo/redo history`.

---

### Task 13: Сборка `.app`

**Files:** Create `electron-builder.yml`; Modify `package.json`

**Interfaces:**
- Produces: `npm run dist` → `release/PhotoMaker Studio.app` (arm64, без подписи), `appId: local.photomaker.studio`.

- [ ] **Step 1:** Настроить `electron-builder.yml` (mac target `dir`, без подписи/нотаризации, `productName: PhotoMaker Studio`).
- [ ] **Step 2:** `npm run dist`; ожидается: в `release/` лежит `PhotoMaker Studio.app`.
- [ ] **Step 3:** Запустить `.app` (первый запуск через «Открыть» из контекстного меню, так как без подписи). Проверка вручную: перетащить `references/IMG_9334.jpg`, выбрать 10×15, применить пресет «Сепия», экспортировать PNG; выключить Wi-Fi и убедиться, что всё работает.
- [ ] **Step 4:** Обновить `plan.md` (отметить этапы 1–4 как выполненные) и добавить короткий `README.md` с командами `dev`, `test`, `dist`.
- [ ] **Step 5: Commit** — `chore: macOS app build and README`.

---

## Самопроверка

- **Покрытие спеки:** форматы и мм/px (T2), dpi (T3, T8), кроп/вписать (T6–T8), HEIC и EXIF (T4), drag&drop и диалог (T5), эффекты (T9), пресеты (T10), экспорт PNG и пакет (T11), undo/redo (T12), `.app` и офлайн (T13), отдельный git (T1). Режим 2, PDF, метки обрезки, рамки, стикеры, текст и проекты не входят в этот план и вынесены в планы 2–3.
- **Согласованность типов:** `CropState`, `EffectParams`, `LoadedImage`, `FitParams`, `DpiLevel` определены один раз и используются теми же именами в последующих задачах.
- **Review Focus:** все пять пунктов привязаны к задачам с тестами или явной ручной проверкой.
