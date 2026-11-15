# PhotoMaker Studio — План 2: режим «Коллаж», лист A4, PDF с метками обрезки

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Второй режим приложения: лист A4 с несколькими фото (шаблоны-сетки, лист из одинаковых снимков, свободный макет), рамки внутри размера, тени, скругление, поворот, эффекты на каждое фото, два вида листа («Страница альбома» и «Лист для вырезания»), экспорт PNG и PDF в точном масштабе с векторными метками обрезки.

**Architecture:** Коллаж — это данные (`Collage` в миллиметрах). Один рендерер `renderCollage` рисует и предпросмотр (малый dpi), и экспорт (300 dpi); каждое фото внутри него рисуется существующим `renderFit` (кроп + эффекты только на окно фото, рамка вокруг). Konva лежит прозрачным слоем поверх предпросмотра и только двигает/поворачивает/масштабирует фото. PDF собирает `pdf-lib`: страница точного размера, растровый лист, метки обрезки — вектором.

**Tech Stack:** то же, что в Плане 1, плюс `konva`, `react-konva`, `pdf-lib`.

**Spec:** `docs/superpowers/specs/2026-11-15-photomaker-studio-design.md` (разделы 3, 6, 7), `plan.md`.

**Предусловие:** План 1 влит в `main` (PR #1) или работа идёт от ветки `feature/fit-mode-mvp`. Новая ветка: `feature/collage-pdf`.

**Не входит (План 3):** стикеры, текст, сохранение и открытие проектов `.pmstudio`. Модель `Collage` и `Layer` проектируется так, чтобы эти слои добавились без переделки: `Layer` сейчас — один тип `PhotoLayer`.

## Global Constraints

- Единицы модели — миллиметры; `px = мм × dpi / 25.4`. Лист — только A4: 210×297 мм (книжный) или 297×210 (альбомный).
- Dpi листа по умолчанию 300, допустимо 150–600; предел результата тот же, что в Плане 1 (`exceedsPixelLimit`, 100 Мпикс).
- Поля листа (безопасная зона) по умолчанию 5 мм, зазор между фото 4 мм; оба значения настраиваются, 0–30 мм.
- Рамка и паспарту **входят в размер фото**: слой 100×150 мм с рамкой 5 мм остаётся 100×150 мм, окно фото 90×140 мм; размеры и метки обрезки считаются по внешнему краю.
- «Страница альбома»: фон, фото с рамками, тени; метки обрезки по умолчанию выключены. «Лист для вырезания»: только фото с рамками, белая бумага, тени и фон не рисуются; метки по умолчанию включены. Переключение вида ничего не теряет.
- Эффекты и пресеты применяются только к окну фото, не к рамке и не к полям (используется `renderFit` с размером окна).
- Пустые и «потерянные» ячейки рисуются только на экране (заглушка) и никогда не попадают в PNG/PDF.
- PDF: страница ровно 210×297 мм (±0,01 мм), растр на всю страницу без масштабирования; метки — векторные линии.
- PNG листа содержит pHYs (`setPngDpi`) как в Плане 1.
- Предпросмотр и экспорт используют один и тот же `renderCollage`; Konva ничего не рисует, кроме рамки выделения и ручек.
- Undo/redo обязательны (тот же принцип: дискретные действия — отдельный шаг, жесты — паузой 400 мс).
- Интерфейс на русском, тема системная, никаких сетевых запросов.
- Сообщения коммитов заканчиваются строкой `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Шаблон или лист из одинаковых снимков при числе фото меньше числа ячеек, при пустой библиотеке и при формате, который не помещается: заглушки на экране, ничего не печатается, понятное сообщение «помещается не более N» (Task 4, 12).
2. Фото удалено из библиотеки, пока стоит в коллаже: слой остаётся заглушкой с теми же размерами, предупреждение, экспорт не падает (Task 1, 9).
3. Повёрнутые, перекрывающиеся и вылезающие за поля фото: метки обрезки не заходят на соседние снимки, перекрытие и выход за поля помечаются (Task 3, 7, 9).
4. Слишком широкая рамка, слой нулевого или крошечного размера, дробные значения: ничего не уходит в отрицательные размеры и NaN (Task 3).
5. PDF и «печать 100%»: размер страницы ровно A4, метки не пропадают на тёмном фоне альбома (Task 8, 13).

---

## Структура файлов

```
src/core/library/libraryStore.ts      общая библиотека фото обоих режимов
src/core/effects/presetStore.ts       пользовательские пресеты (вынесены из fitStore)
src/core/collage/model.ts             типы, значения по умолчанию, окно фото, рамка
src/core/collage/geometry.ts          углы, пересечения, вхождение в прямоугольник
src/core/collage/layout.ts            шаблоны-сетки и лист из одинаковых снимков
src/core/collage/marks.ts             сегменты меток обрезки
src/core/collage/warnings.ts          предупреждения и dpi слоя
src/core/render/background.ts         цвет, градиент, процедурные текстуры
src/core/render/renderCollage.ts      единый рендерер листа
src/core/export/pdf.ts                сборка PDF (pdf-lib)
src/modes/collage/collageStore.ts     состояние, действия, история
src/modes/collage/{CollageMode,CollageStage,Inspector,SheetToolbar,ExportBar}.tsx
src/modes/collage/stageGeometry.ts    мм ↔ пиксели сцены и узлы Konva
src/ui/EffectsPanel.tsx               панель эффектов и пресетов (общая)
src/app/App.tsx                       вкладки «Подгонка» / «Коллаж»
```

---

### Task 1: Общая библиотека фото и вкладки режимов

**Files:**
- Create: `src/core/library/libraryStore.ts`, `tests/libraryStore.test.ts`
- Modify: `src/modes/fit/fitStore.ts`, `src/modes/fit/FitMode.tsx`, `src/modes/fit/CropStage.tsx`, `src/modes/fit/Controls.tsx`, `src/app/App.tsx`, `tests/fitStore.test.ts`, `tests/fitStoreParams.test.ts`

**Interfaces:**
- Produces:
  - `useLibraryStore`: `images: LoadedImage[]`, `selectedId: string | null`, `errors: LoadError[]`, `addFiles(files: File[]): Promise<void>`, `select(id: string): void`, `remove(id: string): void`, `clearErrors(): void`
  - `imageById(s: Pick<LibraryState,'images'>, id: string | null): LoadedImage | undefined`
  - `onImageRemoved(fn: (id: string) => void): () => void` — подписка на удаление (возвращает отписку)
  - `LoadError` переезжает сюда из `fitStore`.
- Consumes: `loadImage` (План 1).
- После задачи `fitStore` больше не хранит `images`, `selectedId`, `errors`, `addFiles`, `select`, `remove`, `clearErrors`; при удалении фото он сам чистит `cropById` и `effectsById` через `onImageRemoved`. `dpiInfo(s: FitState, lib: Pick<LibraryState,'images'|'selectedId'>)` принимает библиотеку вторым аргументом.

- [ ] **Step 1: Failing tests** `tests/libraryStore.test.ts`: перенести из `fitStore.test.ts` тесты `addFiles` (битый файл не прерывает загрузку, ошибка записана, выбрано первое успешное; повторная загрузка не меняет выбор) и `remove` (выбирается соседнее; последнее выбранное → предыдущее; единственное → `null`; удаление невыбранного не меняет выбор), `clearErrors`. Добавить: `onImageRemoved` вызывается с id удалённого фото и отписка работает; удаление не существующего id ничего не вызывает. В `fitStoreParams.test.ts` добавить: после удаления фото его запись в `cropById` и `effectsById` исчезает. Старые тесты в `fitStore.test.ts` удалить после переноса.
- [ ] **Step 2:** `npx vitest run tests/libraryStore.test.ts` → FAIL (модуль не найден).
- [ ] **Step 3: Implement** `libraryStore.ts` (логика переносится из `fitStore` без изменения поведения); `fitStore` подписывается на `onImageRemoved` при создании; `FitMode`, `CropStage`, `Controls`, `Thumbs`-вызовы переключаются на `useLibraryStore`.
- [ ] **Step 4:** `App.tsx` — две вкладки «Подгонка» и «Коллаж» (по умолчанию «Подгонка»); вкладка «Коллаж» пока показывает заголовок-заглушку. Библиотека и перетаскивание файлов общие для обеих вкладок (обработчик drop остаётся в `App`).
- [ ] **Step 5:** `npm test` → всё зелёное, `npx tsc --noEmit` чисто; ручная проверка: режим «Подгонка» работает как раньше (загрузка, кроп, экспорт).
- [ ] **Step 6: Commit** — `refactor: shared photo library and mode tabs`.

---

### Task 2: Общая панель эффектов и пресеты

**Files:**
- Create: `src/core/effects/presetStore.ts`, `src/ui/EffectsPanel.tsx`, `tests/presetStore.test.ts`
- Modify: `src/modes/fit/fitStore.ts`, `src/modes/fit/Controls.tsx`, `tests/fitStoreParams.test.ts`

**Interfaces:**
- Produces:
  - `usePresetStore`: `userPresets: Preset[]`, `loadUserPresets(): Promise<void>`, `addPreset(name: string, params: EffectParams): Preset | null`, `deletePreset(id: string): void` (поведение как в Плане 1)
  - `EffectsPanel(props: { value: EffectParams; onChange: (next: EffectParams) => void }): JSX.Element` — пресеты, «Сбросить», «Сохранить как пресет…», флажки Ч/Б и Сепия, семь ползунков.
- Consumes: `BUILTIN_PRESETS`, `parsePresets`, `serializePresets` (План 1).

- [ ] **Step 1: Failing tests** `presetStore.test.ts`: четыре теста пресетов из `fitStoreParams.test.ts` (обрезка имени, пустое имя → `null`, удаление своего, встроенный не удаляется) переезжают без изменений в логике, импорт — из `presetStore`.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `presetStore.ts` (код переносится из `fitStore`), `EffectsPanel.tsx` (код блока «Эффекты» из `Controls.tsx`), `Controls.tsx` использует `EffectsPanel`.
- [ ] **Step 4:** `npm test` зелёный; скриншот режима «Подгонка»: блок эффектов выглядит и работает как раньше.
- [ ] **Step 5: Commit** — `refactor: extract preset store and shared effects panel`.

---

### Task 3: Модель коллажа и геометрия

**Files:** Create `src/core/collage/model.ts`, `src/core/collage/geometry.ts`, `tests/collageModel.test.ts`, `tests/collageGeometry.test.ts`

**Interfaces:**
- Produces (`model.ts`):
  - `type SheetKind = 'album' | 'cut'`
  - `type TextureId = 'paper' | 'kraft' | 'chalk'`
  - `type Background = { type: 'color'; color: string } | { type: 'gradient'; from: string; to: string; angleDeg: number } | { type: 'texture'; id: TextureId }`
  - `type Sheet = { kind: SheetKind; orientation: Orientation; safeMarginMm: number; gapMm: number; background: Background; cropMarks: boolean; dpi: number }`
  - `type Frame = { widthMm: number; color: string }`, `type Shadow = { enabled: boolean; blurMm: number; offsetMm: number; opacity: number }`
  - `type PhotoLayer = { id: string; type: 'photo'; imageId: string | null; xMm: number; yMm: number; widthMm: number; heightMm: number; rotationDeg: number; crop: CropState; frame: Frame; shadow: Shadow; cornerRadiusMm: number; effects: EffectParams }` — `xMm, yMm` — левый верхний угол неповёрнутого прямоугольника, поворот вокруг центра.
  - `type Layer = PhotoLayer`, `type Collage = { sheet: Sheet; layers: Layer[] }`
  - `defaultSheet(kind?: SheetKind): Sheet` (альбом: белый фон `#ffffff`, метки выкл.; вырезание: метки вкл.), `newPhotoLayer(p: Partial<PhotoLayer> & Pick<PhotoLayer,'xMm'|'yMm'|'widthMm'|'heightMm'>): PhotoLayer` (id — `crypto.randomUUID()`, рамка 0 мм `#ffffff`, тень выкл. `{blurMm:3, offsetMm:1.5, opacity:0.35}`, радиус 0, поворот 0, `DEFAULT_CROP`, `NO_EFFECTS`)
  - `sheetSizeMm(s: Pick<Sheet,'orientation'>): { widthMm: number; heightMm: number }`
  - `safeRect(s: Sheet): Rect` (в мм)
  - `effectiveFrameMm(l: PhotoLayer): number` — `clamp(frame.widthMm, 0, min(w, h) / 2 − 1)`, не меньше 0
  - `photoWindow(l: PhotoLayer): Rect` — окно фото в локальных координатах слоя (отступ на `effectiveFrameMm` со всех сторон), ширина и высота не меньше 2 мм
- Produces (`geometry.ts`): `type Point = { x: number; y: number }`; `corners(l: PhotoLayer): Point[]` (4 угла по часовой начиная с верхнего левого, с учётом поворота); `polygonsIntersect(a: Point[], b: Point[], epsilon?: number): boolean` (пересечение с учётом площади; касание сторон — не пересечение); `layerInsideRect(l: PhotoLayer, r: Rect): boolean`; `clampLayerIntoSheet(l: PhotoLayer, sheetMm: {widthMm:number;heightMm:number}): PhotoLayer` (двигает слой, чтобы габарит повёрнутого прямоугольника лежал в листе, если он вообще влезает).
- Consumes: `Rect`, `CropState` (`geometry.ts` Плана 1), `Orientation`.

- [ ] **Step 1: Failing tests:** `sheetSizeMm` portrait = 210×297, landscape = 297×210; `safeRect` при поле 5 мм = `{x:5,y:5,width:200,height:287}`; `photoWindow` слоя 100×150 мм с рамкой 5 мм = `{x:5,y:5,width:90,height:140}`; рамка 80 мм на слое 100×150 зажимается до 49 мм, окно не меньше 2×2 мм (Review Focus 4); отрицательная и `NaN`-рамка → 0; `corners` слоя `(50,50,100,50)` с поворотом 90° лежат в габарите x∈[75,125], y∈[25,125]; `polygonsIntersect`: перекрывающиеся квадраты → true, соприкасающиеся сторонами → false, разнесённые → false, повёрнутые на 45° с перекрытием → true; `layerInsideRect` ложно для слоя, торчащего на 1 мм за поле; `clampLayerIntoSheet` слоя `x=250` в портретном листе даёт `x = 210 − width`; слой шире листа не меняет размер и прижимается к `x = 0`.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** оба файла (чистые функции, без DOM).
- [ ] **Step 4:** тесты и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(core): collage model and geometry`.

---

### Task 4: Раскладка — шаблоны и лист из одинаковых снимков

**Files:** Create `src/core/collage/layout.ts`, `tests/layout.test.ts`

**Interfaces:**
- Consumes: `Sheet`, `PhotoLayer`, `newPhotoLayer`, `safeRect`, `sheetSizeMm` (Task 3), `Rect`.
- Produces:
  - `type Template = { id: '2' | '3' | '4' | '6'; label: string; count: number; cells: Rect[] }` — клетки в долях безопасной зоны (0..1) для книжного листа; `const TEMPLATES: Template[]` — «2»: два фото друг под другом; «3»: большое сверху и два снизу; «4»: сетка 2×2; «6»: 2 столбца × 3 строки.
  - `applyTemplate(sheet: Sheet, templateId: Template['id'], existing: PhotoLayer[]): PhotoLayer[]` — клетки превращаются в слои с зазором `sheet.gapMm` между соседями; `imageId` берутся по порядку из `existing`, недостающие — `null`, лишние фото в лист не попадают; в альбомном листе клетки транспонируются (x↔y, w↔h).
  - `packIdentical(sheet: Sheet, sizeMm: { widthMm: number; heightMm: number }): { cells: Rect[]; rotated: boolean; max: number }` — равномерная сетка по центру безопасной зоны; пробуются обе ориентации фото, выбирается та, где помещается больше (при равенстве — без поворота); `cols = floor((W + gap) / (w + gap))`, `rows = floor((H + gap) / (h + gap))`; `max = 0` и пустые `cells`, если не помещается ни одно.
  - `fillIdentical(sheet: Sheet, sizeMm: { widthMm: number; heightMm: number }, imageIds: string[], count: number | 'max'): { layers: PhotoLayer[]; max: number; placed: number }` — фото из `imageIds` циклически; при пустом списке — слои с `imageId: null`; `count` больше `max` → размещается `max`.
  - `fitMessage(max: number, requested: number, label: string): string | null` — `null`, если всё помещается; иначе «На лист помещается не более {max} снимков {label} (запрошено {requested})»; при `max = 0`: «Формат {label} не помещается на лист с такими полями».

- [ ] **Step 1: Failing tests** (A4 книжный, поля 5, зазор 4):
  - `packIdentical` для 90×130 → `max = 4`, `rotated = false`, первая клетка `{x:13, y:16.5, width:90, height:130}`, вторая по x — 107, вторая по y — 150.5;
  - 100×150 → `max = 2`, `rotated = true` (клетки 150×100); 130×180 → `max = 2`, `rotated = true`; 30×40 → `max = 36`; 150×210 → `max = 1`; 300×400 → `max = 0`;
  - при полях и зазоре 0 формат 100×150 даёт `max = 2` (четыре не помещаются: 300 мм > 297 мм) (Review Focus 1);
  - `fillIdentical(…, ['a','b'], 4)` для 90×130 → `imageId` по кругу `a,b,a,b`; `count = 'max'` на 100×150 → 2 слоя; `count = 4` на 100×150 → `placed = 2`, `max = 2`;
  - `fillIdentical` с пустым `imageIds` → 4 слоя с `imageId: null` для 90×130;
  - `applyTemplate('4')`: 4 слоя, все внутри `safeRect`, горизонтальный и вертикальный зазор ровно 4 мм, попарно не пересекаются; `'3'` → 3 слоя, `'6'` → 6, `'2'` → 2; в альбомном листе все слои тоже внутри `safeRect`; `existing` с `imageId` `a,b` и шаблон 4 → `a,b,null,null`; `existing` из четырёх и шаблон 2 → `a,b`;
  - `fitMessage(2, 4, '10×15')` содержит «не более 2» и «запрошено 4»; `fitMessage(4, 4, …)` → `null`; `fitMessage(0, 1, '30×40')` содержит «не помещается».
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `layout.ts`.
- [ ] **Step 4:** тесты и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(core): collage templates and identical-photo packing`.

---

### Task 5: Фон — цвет, градиент, текстуры

**Files:** Create `src/core/render/background.ts`, `tests/background.test.ts`

**Interfaces:**
- Consumes: `Background`, `TextureId` (Task 3).
- Produces:
  - `TEXTURES: { id: TextureId; label: string }[]` — «Бумага», «Крафт», «Грифельная доска»
  - `drawBackground(ctx: Ctx2D, bg: Background, w: number, h: number): void` — рисует на весь холст `w×h` пикселей; текстуры процедурные и детерминированные (фиксированный seed, без `Math.random`), поэтому предпросмотр и экспорт одинаковы по узору при разных dpi (шум привязан к доле размера, не к пикселю). `Ctx2D` — тот же минимальный тип, что в `renderFit`.

- [ ] **Step 1: Failing tests** (`@napi-rs/canvas`): цвет `#336699` → пиксель `(10,10)` = `[51,102,153,255]`; градиент `from #000000 → to #ffffff`, `angleDeg 0`: левый край красный канал < 10, правый > 245, середина в диапазоне 118–138; `angleDeg 90` меняется сверху вниз; текстура `kraft`: средний цвет по холсту 64×64 имеет `r > g > b`, стандартное отклонение яркости > 1 (не плоская); `chalk` тёмная (средняя яркость < 80); две отрисовки одной текстуры побайтово равны.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `background.ts` (градиент — по `createLinearGradient` вдоль угла; текстура — базовый цвет + детерминированный шум seed-ом на крупной сетке с билинейной интерполяцией, чтобы узор масштабировался с размером).
- [ ] **Step 4:** тесты зелёные.
- [ ] **Step 5: Commit** — `feat(render): sheet backgrounds with procedural textures`.

---

### Task 6: Рендерер листа `renderCollage`

**Files:** Create `src/core/render/renderCollage.ts`, `tests/renderCollage.test.ts`

**Interfaces:**
- Consumes: `Collage`, `PhotoLayer`, `photoWindow`, `effectiveFrameMm`, `sheetSizeMm` (Task 3), `drawBackground` (Task 5), `renderFit`, `CanvasFactory`, `CanvasLike`, `RenderSource` (План 1), `mmToPx`.
- Produces:
  - `type AssetLookup = (imageId: string) => { full: RenderSource; preview: RenderSource } | undefined`
  - `type RenderOptions = { dpi: number; source: 'preview' | 'full'; placeholders: boolean; drawMarks: boolean }`
  - `type WindowCache = Map<string, CanvasLike>`
  - `renderCollage(c: Collage, assets: AssetLookup, o: RenderOptions, create: CanvasFactory, cache?: WindowCache): CanvasLike` — результат `mmToPx(210, dpi) × mmToPx(297, dpi)` (или 297×210 для альбомного листа).
- Порядок рисования: фон (`album` — `drawBackground`; `cut` — белый) → слои снизу вверх: тень (только `album`, только если `shadow.enabled`) → рамка (скруглённый прямоугольник цвета рамки на весь слой) → окно фото (`renderFit` с `widthMm/heightMm` окна, `mode: 'crop'`, `crop` и `effects` слоя, обрезка по скруглению) → при `placeholders` и пустом/потерянном фото: серая заглушка с диагональной штриховкой. Поворот — вокруг центра слоя. Метки обрезки (`drawMarks`) — тонкие линии 0,2 мм из `cropMarkSegments` (Task 7) поверх всего; в этой задаче параметр принимается, а сама отрисовка подключается в Task 7.
- Кэш окна: ключ — `imageId`, источник (`preview`/`full`), размер окна в пикселях, `JSON.stringify` от `crop` и `effects`; при перетаскивании слоя окно не перерисовывается.

- [ ] **Step 1: Failing tests** (dpi 25.4 → 1 пиксель = 1 мм; сплошные цвета, пробы вдали от краёв):
  - размер листа: портрет 210×297, альбом 297×210;
  - альбом: пиксель `(0,0)` = цвет фона; слой `(50,50,100,150)` с белой рамкой 5 мм поверх синего фото: пиксель `(52,52)` белый, `(100,125)` синий, `(160,125)` — фон; последний пиксель внутри слоя `(149,199)` — рамка, а `(151,200)` — фон (рамка внутри размера);
  - `cut`: фон игнорируется (белый), тень включённая не рисуется (пиксель рядом со слоем остаётся белым), а на `album` тень затемняет пиксель справа-снизу от слоя;
  - поворот 90° слоя `(50,50,100,50)` (центр `(100,75)`, после поворота занимает x∈[75,125], y∈[25,125]): пиксель `(100,40)` — фото (в неповёрнутом слое там пусто), пиксель `(60,60)` — фон (в неповёрнутом слое там фото);
  - радиус скругления 10 мм: угловой пиксель внутри окна — фон, центр — фото;
  - эффект сепия на слое с белой рамкой: пиксель рамки остаётся `[255,255,255,255]`, пиксель фото меняется (Review Focus: эффекты не касаются рамки);
  - слой с `imageId`, которого нет в `assets`, и `placeholders: false` → область слоя как фон; при `placeholders: true` — отличается от фона;
  - `drawMarks: false` не рисует ничего лишнего;
  - кэш: счётчик вызовов фабрики при втором `renderCollage` с тем же кэшем и сдвинутым слоем равен 1 (только лист), при первом — 1 + число слоёв с фото.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `renderCollage.ts`.
- [ ] **Step 4:** тесты и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(render): collage renderer shared by preview and export`.

---

### Task 7: Метки обрезки

**Files:** Create `src/core/collage/marks.ts`, `tests/marks.test.ts`; Modify `src/core/render/renderCollage.ts`

**Interfaces:**
- Consumes: `PhotoLayer`, `corners`, `polygonsIntersect` (Task 3).
- Produces:
  - `type Segment = { x1: number; y1: number; x2: number; y2: number }` (мм)
  - `type MarkOptions = { offsetMm: number; lengthMm: number; clearanceMm: number }`; по умолчанию `{ offsetMm: 1, lengthMm: 2.5, clearanceMm: 0.3 }`
  - `cropMarkSegments(layers: PhotoLayer[], sheetMm: { widthMm: number; heightMm: number }, o?: Partial<MarkOptions>): Segment[]`
- Правила: на каждом углу внешнего прямоугольника слоя (рамка входит) — два сегмента, продолжающие его стороны наружу, начало на `offsetMm` от угла; направление следует повороту слоя; сегмент обрезается у первого пересечения с другим слоем (расширенным на `clearanceMm`); если после обрезки осталось меньше 0,8 мм — сегмент отбрасывается; сегменты, выходящие за лист, отбрасываются.
- `renderCollage` при `drawMarks: true` рисует эти сегменты линиями 0,2 мм (чёрные с тонкой белой подложкой, чтобы были видны на тёмном фоне).

- [ ] **Step 1: Failing tests:** слой `(50,50,100,150)` без соседей → 8 сегментов, среди них `{x1:49,y1:50,x2:46.5,y2:50}` и `{x1:50,y1:49,x2:50,y2:46.5}` для левого верхнего угла и `{x1:151,y1:200,x2:153.5,y2:200}`, `{x1:150,y1:201,x2:150,y2:203.5}` для правого нижнего; два слоя 90×130 мм с зазором 4 мм: сегмент между ними идёт от 101 до 103,5 и целиком сохраняется; при зазоре 3 мм он обрезан до x = 102,7 (длина 1,7 мм); при зазоре 2 мм сегмент отброшен (свободно 0,7 мм) (Review Focus 3); повёрнутый на 90° слой — 8 сегментов, каждый горизонтален или вертикален, и ни одна точка сегмента не лежит внутри многоугольника слоя; сегмент, уходящий за левый край листа (слой в `x = 0,5`), отброшен; ни один сегмент не пересекает ни один из слоёв (для набора из нескольких слоёв, включая повёрнутый).
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `marks.ts`; в `renderCollage.test.ts` добавить: при `drawMarks: true` пиксель на сегменте `(48,50)` тёмный, при `false` — нет.
- [ ] **Step 4:** тесты и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(collage): vector-ready crop marks that never cross neighbours`.

---

### Task 8: Сборка PDF

**Files:** Create `src/core/export/pdf.ts`, `tests/pdf.test.ts`; Modify `electron/api-types.ts`, `electron/preload.ts`, `electron/main.ts`

**Interfaces:**
- Consumes: `Segment` (Task 7).
- Produces:
  - `buildPdf(a: { image: Uint8Array; imageType: 'jpeg' | 'png'; sheetMm: { widthMm: number; heightMm: number }; marks: Segment[] }): Promise<Uint8Array>` — одна страница `мм × 72 / 25,4` пунктов, изображение на всю страницу, метки — векторные линии: белая подложка 0,6 pt и чёрная 0,25 pt.
  - `window.api.savePdf(defaultName: string, data: Uint8Array): Promise<boolean>` (диалог «Сохранить как…», фильтр `pdf`, по образцу `savePng`).
- Зависимость: `pdf-lib` (devDependency).

- [ ] **Step 1: Failing tests:** PDF с JPEG (созданным `@napi-rs/canvas`) загружается через `PDFDocument.load`: страниц 1, размер книжной страницы 595,276 × 841,89 pt (±0,01), альбомной — наоборот; в пересчёте на мм — 210 × 297 (±0,01); PDF с 8 метками по размеру больше, чем без меток, и в нём больше операторов линий; PNG-вариант (`imageType: 'png'`) тоже собирается.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `pdf.ts`; добавить `savePdf` в IPC (`pdf:save`) аналогично `png:save` (проверка типов аргументов).
- [ ] **Step 4:** тесты зелёные; `node scripts/build-electron.mjs` собирается.
- [ ] **Step 5: Commit** — `feat(export): exact-size A4 PDF with vector crop marks`.

---

### Task 9: Состояние коллажа, история, предупреждения

**Files:** Create `src/modes/collage/collageStore.ts`, `src/core/collage/warnings.ts`, `tests/collageStore.test.ts`, `tests/warnings.test.ts`

**Interfaces:**
- Consumes: Task 3, 4, `History` (План 1), `onImageRemoved`, `imageById` (Task 1), `effectiveDpi`, `dpiLevel`, `cropRect`.
- Produces (`warnings.ts`):
  - `type Warning = { layerId: string; kind: 'outside' | 'overlap' | 'empty' | 'missing' | 'low-dpi'; level: 'info' | 'warn' | 'error'; text: string }`
  - `layerDpi(l: PhotoLayer, img: { width: number; height: number }): number` — эффективный dpi по окну фото и кропу (меньшее из значений по сторонам)
  - `collageWarnings(c: Collage, images: Pick<LoadedImage,'id'|'width'|'height'>[]): Warning[]` — `outside`: слой не лежит в безопасной зоне; `overlap`: пересечение слоёв **только для вида `cut`**; `empty`: `imageId = null`; `missing`: `imageId` не найден в библиотеке; `low-dpi`: уровень `warn` при < 300, `error` при < 150.
- Produces (`collageStore.ts`): `useCollageStore` с полями `collage: Collage`, `selectedLayerId: string | null`, `canUndo`, `canRedo`, действиями:
  - дискретные (отдельный шаг истории): `setKind(k)`, `setOrientation(o)` (слои зажимаются в лист `clampLayerIntoSheet`), `setSafeMargin(mm)`, `setGap(mm)` (значения 0–30), `setCropMarks(on)`, `setBackground(b)`, `applyTemplate(id)`, `fillIdentical(sizeMm, count)` (используется библиотека: `imageIds` — выбранное фото или все), `addLayer(imageId)` (размер 90×130 мм, смещение каскадом +5 мм, внутри безопасной зоны), `removeLayer(id)`, `assignImage(layerId, imageId | null)`, `bringForward(id)`, `sendBackward(id)`, `select(id | null)`;
  - непрерывные (склеиваются паузой 400 мс): `updateLayer(id, patch: Partial<PhotoLayer>)` — применяет `effectiveFrameMm`-ограничения и минимальный размер 10×10 мм, отбрасывает `NaN`;
  - `undo()`, `redo()`, `resetHistory()` — тот же принцип, что в `fitStore` (история создаётся сразу из начального значения; `undo`/`redo` сначала фиксируют незавершённый жест).
  - при удалении фото из библиотеки (`onImageRemoved`) слои с этим `imageId` получают `imageId: null`, размеры сохраняются.

- [ ] **Step 1: Failing tests:** предупреждения: слой на 1 мм за полем → `outside`; два пересекающихся слоя в `cut` → `overlap`, в `album` → нет; `imageId: null` → `empty`; `imageId` без фото в библиотеке → `missing`; фото 1000×1500 в окне 100×150 мм (рамка 0) → dpi ≈ 254 → `low-dpi`/`warn`; 500×750 → `error`; `layerDpi` с зумом 2 вдвое меньше. Стор: `addLayer` создаёт слой внутри `safeRect`, выбирает его; второй слой смещён на 5 мм; `updateLayer(id, { widthMm: 3 })` даёт 10 мм, `{ xMm: NaN }` не меняет слой; рамка шире допустимой не ломает окно; `setOrientation('landscape')` затем `'portrait'` не оставляет слой за листом; `applyTemplate('4')` даёт 4 слоя, `undo()` возвращает прежний набор; серия из 20 `updateLayer` и ожидание 1000 мс → один шаг `undo`; `undo` сразу после `updateLayer` (до паузы) откатывает правку; `setKind('cut')` включает метки при первом переходе и не теряет слои, переключение обратно возвращает фон и тени (слои не изменены); удаление фото из библиотеки превращает слои в пустые (Review Focus 2); `bringForward` меняет порядок; `setGap(99)` → 30, `setGap(-1)` → 0.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `warnings.ts` и `collageStore.ts`.
- [ ] **Step 4:** весь набор тестов и `tsc` зелёные.
- [ ] **Step 5: Commit** — `feat(collage): store with history and layout warnings`.

---

### Task 10: Сцена — предпросмотр и перемещение мышью

**Files:** Create `src/modes/collage/stageGeometry.ts`, `src/modes/collage/CollageStage.tsx`, `src/modes/collage/CollageMode.tsx`, `tests/stageGeometry.test.ts`; Modify `src/app/App.tsx`, `package.json`

**Interfaces:**
- Consumes: `useCollageStore`, `renderCollage`, `useLibraryStore`.
- Produces (`stageGeometry.ts`):
  - `stageScale(containerPx: { width: number; height: number }, sheetMm: { widthMm: number; heightMm: number }, padding?: number): number` — пикселей на мм так, чтобы лист целиком помещался
  - `toNode(l: PhotoLayer, scale: number): { x: number; y: number; width: number; height: number; offsetX: number; offsetY: number; rotation: number }` — Konva-узел с началом в центре слоя
  - `fromNode(n: { x: number; y: number; width: number; height: number; scaleX: number; scaleY: number; rotation: number }, scale: number): Pick<PhotoLayer, 'xMm'|'yMm'|'widthMm'|'heightMm'|'rotationDeg'>`
- `CollageStage`: нижний слой — `<canvas>` с `renderCollage` (`source: 'preview'`, `placeholders: true`, `drawMarks: true`, общий `WindowCache`, dpi подбирается так, чтобы лист занимал ширину сцены); поверх — `react-konva` `Stage` с прозрачными `Rect` на каждый слой и `Transformer` для выбранного; перетаскивание и трансформация пишут в `updateLayer`; клик по пустому месту снимает выбор. Зависимости: `konva`, `react-konva` (devDependencies).

- [ ] **Step 1: Failing tests:** `stageScale` для контейнера 800×1000 и листа 210×297 → `min(800/210, 1000/297)` с учётом отступа; `toNode` слоя `(50,50,100,150)`, scale 2 → `x = 200, y = 250` (центр), `width = 200`, `height = 300`, `offsetX = 100`, `offsetY = 150`, `rotation = 0`; `fromNode` обратно возвращает исходный слой (круговая проверка), в том числе с поворотом 30°; узел после растяжения `scaleX = 0.5` при scale 2 даёт ширину 50 мм при том же центре (`xMm` сдвигается на 25 мм); `scaleX/scaleY` отрицательные не дают отрицательных размеров (берётся модуль).
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement** `stageGeometry.ts`, `CollageStage.tsx`, `CollageMode.tsx` (сцена по центру, пока без панелей), вкладка «Коллаж» открывает `CollageMode`.
- [ ] **Step 4:** тесты и `tsc` зелёные; проверка в живом приложении: добавить слой, перетащить мышью (синтетические события через CDP `Input.dispatchMouseEvent`) → `xMm`/`yMm` изменились на ожидаемое число мм; скриншот листа с двумя фото.
- [ ] **Step 5: Commit** — `feat(collage): preview stage with drag, rotate and resize`.

---

### Task 11: Инспектор выбранного фото

**Files:** Create `src/modes/collage/Inspector.tsx`, `src/modes/collage/fields.ts`, `tests/inspectorHelpers.test.ts`; Modify `src/modes/collage/CollageMode.tsx`

**Interfaces:**
- Consumes: `useCollageStore`, `EffectsPanel` (Task 2), `layerDpi` (Task 9), `useLibraryStore`.
- Produces: `Inspector()` — панель справа для выбранного слоя: фото (выпадающий список библиотеки + «Пусто»), рамка (толщина 0–50 мм, цвет), тень (флажок, размытие, смещение, прозрачность; недоступна на листе для вырезания с пояснением), скругление 0–30 мм, поворот −180…180° (число и ползунок), масштаб кропа 1–8 и сдвиг по X и Y 0–1, порядок («Вперёд»/«Назад»), «Удалить слой», бейдж dpi слоя (как в режиме «Подгонка»), блок эффектов (`EffectsPanel`, значение — `layer.effects`).
- `parseMmField(text: string, min: number, max: number): number | null` — разбор поля в мм через `parseDecimal`; значение вне диапазона зажимается, мусор → `null` (поле не меняется).

- [ ] **Step 1: Failing tests** (`inspectorHelpers.test.ts`): `parseMmField('5,5', 0, 50)` = 5.5; `'abc'` → `null`; `'99'` → 50; `'-3'` → `null`.
- [ ] **Step 2–3:** FAIL → реализовать `parseMmField` (рядом, в `src/modes/collage/fields.ts`) и `Inspector.tsx`.
- [ ] **Step 4:** тесты зелёные; скриншот панели при выбранном слое, ручная проверка: рамка 5 мм не меняет размер слоя на сцене, сепия не окрашивает рамку, скругление и поворот видны.
- [ ] **Step 5: Commit** — `feat(collage): layer inspector with frame, shadow, radius, rotation and effects`.

---

### Task 12: Панель листа — вид, шаблоны, одинаковые снимки, фон

**Files:** Create `src/modes/collage/SheetToolbar.tsx`; Modify `src/modes/collage/CollageMode.tsx`. Тестируемая логика (`fillIdentical`, `fitMessage`, шаблоны) уже покрыта в Task 4 и 9; здесь — интерфейс поверх неё.

**Interfaces:**
- Consumes: `useCollageStore`, `TEMPLATES`, `fillIdentical`, `fitMessage` (Task 4), `PRINT_FORMATS`, `customFormat`, `TEXTURES` (Task 5), `useLibraryStore`.
- Produces: `SheetToolbar()` — слева: переключатель «Страница альбома / Лист для вырезания», ориентация листа, поля и зазор (мм), флажок «Метки обрезки», кнопки шаблонов «2 / 3 / 4 / 6», блок «Одинаковые снимки» (формат из `PRINT_FORMATS` или свой, количество — число или «Максимум», источник фото — выбранное или все; под блоком — сообщение `fitMessage`, если не всё помещается), редактор фона (цвет, градиент с двумя цветами и углом, текстуры; на листе для вырезания блок неактивен с пояснением), полоса библиотеки: клик по миниатюре добавляет слой, а если выбран пустой слой — подставляет фото в него.

- [ ] **Step 1:** реализовать `SheetToolbar.tsx`; формат «своё» валидируется `customFormat`/`parseDecimal`, ошибка — подсказкой под полем; новых юнит-тестов нет (UI поверх уже протестированной логики), приёмка — ручная и по скриншотам.
- [ ] **Step 2:** ручная проверка в живом приложении: шаблон «4» с двумя загруженными фото → четыре ячейки, две заполнены, две заглушки; «Одинаковые снимки» 10×15, количество 4 → 2 слоя и сообщение «не более 2 … запрошено 4»; формат 30×40 на максимум → 36 слоёв; переключение «Лист для вырезания» убирает фон и тени, включает метки; обратно возвращает (Review Focus 1).
- [ ] **Step 3:** `npm test`, `tsc` зелёные.
- [ ] **Step 4: Commit** — `feat(collage): sheet toolbar with templates, identical-photo fill and backgrounds`.

---

### Task 13: Экспорт PNG и PDF, список предупреждений

**Files:** Create `src/modes/collage/ExportBar.tsx`, `src/modes/collage/exportCollage.ts`, `tests/exportCollage.test.ts`; Modify `src/modes/collage/CollageMode.tsx`

**Interfaces:**
- Consumes: `renderCollage`, `cropMarkSegments`, `buildPdf`, `setPngDpi`, `exceedsPixelLimit`, `collageWarnings`, `window.api.savePng`/`savePdf`.
- Produces (`exportCollage.ts`):
  - `exportBaseName(kind: SheetKind): string` — `лист-альбом` / `лист-вырезание`
  - `renderSheetPng(c: Collage, assets: AssetLookup): Promise<Uint8Array>` — `renderCollage` с `source: 'full'`, `placeholders: false`, `drawMarks: c.sheet.cropMarks`, затем `setPngDpi(…, c.sheet.dpi)`
  - `renderSheetPdf(c: Collage, assets: AssetLookup): Promise<Uint8Array>` — растр **без** меток (`drawMarks: false`), JPEG качества 0,95, метки — вектором (`cropMarkSegments`), если `sheet.cropMarks`
  - `warningText(w: Warning): string` и `canExport(c: Collage): string | null` (сообщение, почему нельзя: размер выше `exceedsPixelLimit` или нет ни одного слоя с фото).
- `ExportBar`: кнопки «Экспорт PNG» и «Экспорт PDF», поле dpi листа (150–600), список предупреждений с цветом по уровню; статус «Сохранено».

- [ ] **Step 1: Failing tests:** `exportBaseName('cut')` = `лист-вырезание`; `canExport` для пустого коллажа возвращает сообщение, для коллажа с фото и dpi 300 — `null`, для dpi 600 на A4 — `null`, а искусственно заданный размер выше предела — сообщение; `renderSheetPng` (подставной `AssetLookup` и `@napi-rs/canvas`) даёт PNG размера 2480×3508 с чанком `pHYs` 11811 пикс/м; `renderSheetPdf` даёт PDF с размером страницы 595,276 × 841,89 pt и **не** содержит меток в растре (проверка: пиксель на месте метки в растре равен фону) при `cropMarks: true`; `warningText` для каждого вида содержит название предупреждения по-русски.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3: Implement**; `ExportBar` вызывает диалоги сохранения; фабрика холста — DOM-`canvas`, JPEG — `canvas.toBlob('image/jpeg', 0.95)`.
- [ ] **Step 4:** тесты зелёные; в живом приложении: собрать лист для вырезания (4 × 9×13 с метками) и вызвать `renderSheetPdf` через dev-сервер → размер страницы 595,276×841,89, число страниц 1; PNG: заголовок IHDR 2480×3508 и `pHYs` 11811.
- [ ] **Step 5: Commit** — `feat(collage): PNG and PDF export with warnings`.

---

### Task 14: Сборка, документация, живая проверка

**Files:** Modify `README.md`, `plan.md`, `electron-builder.yml` (при необходимости)

- [ ] **Step 1:** `npm run dist`; ожидается `release/mac-arm64/PhotoMaker Studio.app`.
- [ ] **Step 2:** запустить собранное приложение с `--remote-debugging-port`, через CDP: загрузить два фото, открыть вкладку «Коллаж», шаблон «4», убедиться в 4 слоях и отсутствии ошибок консоли; проверить скриншотом оба вида листа.
- [ ] **Step 3:** обновить `README.md` (режим «Коллаж», PDF, метки) и `plan.md` (этап 5–6 выполнены: сетки, свободный макет, PDF, метки; осталось — стикеры, текст, проекты).
- [ ] **Step 4:** `npm test` зелёный, `tsc` чисто.
- [ ] **Step 5: Commit** — `chore: build, docs for collage mode`.

---

## Самопроверка

- **Покрытие спеки:** лист A4 и два вида (T3, 6, 12), шаблоны 2/3/4/6 и лист из одинаковых снимков с полями, зазором и расчётом максимума (T4), свободный макет с перемещением, поворотом, масштабом и порядком (T9, 10, 11), фон — цвет, градиент, текстуры (T5), рамка внутри размера (T3, 6), тени, скругление, поворот, эффекты на фото (T6, 11), метки обрезки (T7), PDF 210×297 мм (T8, 13), PNG с 300 dpi (T13), поля принтера и предупреждения (T9, 13), undo/redo (T9). Стикеры, текст и проекты — в Плане 3.
- **Согласованность типов:** `PhotoLayer`, `Collage`, `Sheet`, `Segment`, `AssetLookup`, `RenderOptions`, `Warning` определены один раз и используются теми же именами; `crop`/`effects` слоя совпадают по типам с Планом 1 (`CropState`, `EffectParams`).
- **Review Focus:** пять пунктов привязаны к задачам с тестами или ручной проверкой.
- **Поправка к спеке:** пример «4 × 10×15 на A4» неверен (300 мм > 297 мм); теперь максимум считается автоматически (на A4 с полями 5 мм и зазором 4 мм: 9×13 → 4, 10×15 → 2, 13×18 → 2, 3×4 → 36).
- **Пропорции:** план около 350 строк при спеке около 150; блоки кода только там, где решения не вытекают из сигнатур.
