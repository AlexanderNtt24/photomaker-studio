# Plan 4 — горячие клавиши, меню и иконка: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (выбран «native»). Шаги — чекбоксы.

**Goal:** Горячие клавиши для работы со слоями, меню приложения на русском с показанными сочетаниями и собственная иконка `.app`.

**Architecture:** Команды (`commandId`) живут в рендерере в маленькой шине (`register/run`). Источников два: меню в главном процессе (клик или сочетание → IPC `menu:command`) и клавиши, которые меню не может держать (Delete, стрелки, Esc: в текстовом поле меню-ускоритель сработал бы при наборе). Меню несёт сочетания с настоящими ускорителями там, где рендерер сам вызывает `preventDefault` для того же сочетания (⌘Z, ⌘S, ⌘O остаются как есть); для остального ускоритель владеет меню. Иконка рисуется SVG-скриптом и собирается в `.icns` системными `sips`/`iconutil`.

**Tech Stack:** Electron 45 `Menu`, React 19, Zustand 5, Vitest 5, `@napi-rs/canvas` (растеризация SVG для иконки).

**Spec:** запрос автора («горячие клавиши и иконка», набор из сообщения «Бери набор выше»), `plan.md` этап 8. Отдельного дизайн-документа нет: автор отказался от вопросов, набор клавиш зафиксирован в этом плане.

## Global Constraints

- Русский интерфейс, ничего не скачивается, внешних запросов нет.
- Клавиши в текстовых полях остаются за полем (как ⌘Z сейчас): Delete/Backspace/стрелки/Esc не трогают слои, когда фокус в `input`, `textarea`, `select` или `contenteditable`.
- Слои: Delete/Backspace удаляет выбранный; стрелки двигают на 1 мм, с Shift на 10 мм; ⌘D дублирует со сдвигом 5 мм; ⌘] выше, ⌘[ ниже; Esc снимает выделение.
- Общие: ⌘E экспорт PNG, ⇧⌘E экспорт PDF (только коллаж, только если экспорт не заблокирован), ⌘1 «Подгонка», ⌘2 «Коллаж».
- Каждое изменение слоя — шаг undo (стрелки сливаются в один шаг по уже существующему таймеру истории).
- Слой после сдвига/дубля остаётся целиком на листе (`clampLayerIntoSheet`).

## Review Focus

- Delete/стрелки при фокусе в поле ввода, в `range`-слайдере и на кнопке: слой не должен удаляться или двигаться; на слайдере стрелки остаются за слайдером.
- Нажатие ⌘D/⌘]/⌘[/Delete без выбранного слоя или в режиме «Подгонка»: ничего не происходит, без ошибок.
- ⌘E при заблокированном экспорте или во время уже идущего экспорта: второго экспорта не запускается.
- Сочетание из меню и из клавиатуры не выполняется дважды (меню срабатывает, только если страница не вызвала `preventDefault`).
- Иконка присутствует в собранном `.app` (`Info.plist`/`Resources`), файл `.icns` не повреждён.

---

### Task 1: Раскладка клавиш слоёв (чистая функция)

**Files:** Create `src/core/hotkeys/layerKeys.ts`; Test `tests/layerKeys.test.ts`.

**Interfaces:**
- Produces:
  `type LayerKeyAction = { type: 'delete' } | { type: 'nudge'; dxMm: number; dyMm: number } | { type: 'deselect' }`
  `type KeyInfo = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }`
  `type KeyContext = { editing: boolean; hasSelection: boolean }`
  `layerKeyAction(e: KeyInfo, ctx: KeyContext): LayerKeyAction | null`
  `isEditingTarget(t: EventTarget | null): boolean` (input кроме `range`/`checkbox`/`color`… — см. тест; textarea; select; contenteditable).

- [ ] **Step 1: тесты (RED).** Имена и утверждения:
  - `Delete` и `Backspace` при `hasSelection` → `{type:'delete'}`; без выделения → null.
  - `ArrowLeft/Right/Up/Down` → `nudge` с (-1,0),(1,0),(0,-1),(0,1); с Shift ×10.
  - `Escape` при `hasSelection` → `deselect`; без выделения → null.
  - При `editing: true` любая из клавиш → null.
  - С `metaKey`, `ctrlKey` или `altKey` → null (⌘←, ⌥← не двигают слой).
  - Прочие клавиши (`a`, `Enter`) → null.
  - `isEditingTarget`: `<textarea>`, `<input type=text>`, `<input type=number>`, `<select>`, `<div contenteditable>` → true; `<input type=range>`, `<input type=checkbox>`, `<input type=color>`, `<button>`, `null` → false (слайдер и кнопка не «редактирование», но стрелки на `range` обработаем отдельно, см. Task 4).
- [ ] **Step 2:** `npx vitest run tests/layerKeys.test.ts` — Expected: FAIL (модуля нет).
- [ ] **Step 3: реализовать** `layerKeys.ts` по контракту выше. `isEditingTarget` проверяет `instanceof HTMLElement` и `isContentEditable`; для `range` стрелки принадлежат слайдеру, поэтому `isEditingTarget` возвращает true для `range` только в паре с ключами-стрелками — реализовать отдельным `ownsArrowKeys(t)` (range, select, textarea, text-like input), а `isEditingTarget` оставить для Delete/Esc. Проверить тестом `ownsArrowKeys(range) === true`.
- [ ] **Step 4:** тест — Expected: PASS.
- [ ] **Step 5: commit** `feat(hotkeys): layer key map`.

### Task 2: `duplicateLayer` и `nudgeLayer` в хранилище

**Files:** Modify `src/modes/collage/collageStore.ts`; Test `tests/collageStore.test.ts` (новый `describe('hotkey actions')`).

**Interfaces:**
- Produces: `duplicateLayer(id: string): void`, `nudgeLayer(id: string, dxMm: number, dyMm: number): void`.

- [ ] **Step 1: тесты (RED)** в `tests/collageStore.test.ts` (хелперы файла `st()`, `put`, `text()`, `sticker()` из блока `non-photo layers` — вынести `put` на уровень файла или повторить):
  - `duplicateLayer` фото/текста/стикера: слоёв +1, новый `id` отличается, копия сверху (последняя), сдвиг +5 мм по x и y, остальные поля равны, копия выбрана; `undo` возвращает исходное число слоёв.
  - Дубль слоя у правого нижнего края листа остаётся целиком на листе.
  - `duplicateLayer('нет такого')` ничего не меняет и не падает.
  - `nudgeLayer(id, 1, 0)` двигает на 1 мм; у левого края `nudgeLayer(id, -50, 0)` даёт `xMm === 0`; NaN игнорируется; 20 вызовов подряд + `undo` возвращают исходное положение одним шагом (как `twenty drag updates`).
- [ ] **Step 2:** запуск файла — Expected: FAIL (`duplicateLayer is not a function`).
- [ ] **Step 3: реализовать** в сторе: `duplicateLayer` копирует слой через `structuredClone`, новый `crypto.randomUUID()`, сдвиг 5 мм, `clampLayerIntoSheet(copy, sheetSizeMm(sheet))`, добавляет в конец, выбирает, `commit()`. `nudgeLayer` вызывает существующий `updateLayer` с зажатыми `xMm/yMm` (зажим через `clampLayerIntoSheet`); так сохраняется слияние в один шаг undo.
- [ ] **Step 4:** весь файл + `npx tsc --noEmit` — Expected: PASS.
- [ ] **Step 5: commit** `feat(collage): duplicate and nudge layers`.

### Task 3: Шина команд, меню и мост в главном процессе

**Files:** Create `src/app/commands.ts`, `electron/menu.ts`; Modify `electron/main.ts`, `electron/preload.ts`, `electron/api-types.ts`, `src/global.d.ts` (если тип `window.api` там); Test `tests/commands.test.ts`, `tests/menuTemplate.test.ts`.

**Interfaces:**
- Produces (`src/app/commands.ts`):
  `type CommandId = 'open' | 'save' | 'save-as' | 'export-png' | 'export-pdf' | 'undo' | 'redo' | 'duplicate' | 'forward' | 'backward' | 'delete' | 'mode-fit' | 'mode-collage'`
  `const COMMAND_IDS: readonly CommandId[]`
  `registerCommand(id: CommandId, fn: () => void): () => void` (возвращает отписку; повторная регистрация того же id заменяет предыдущую, отписка старой не затирает новую)
  `runCommand(id: string): boolean` (false, если команды нет или id неизвестен)
- Produces (`electron/menu.ts`): `menuTemplate(send: (id: CommandId) => void, opts: { isMac: boolean; appName: string }): MenuItemConstructorOptions[]`; `electron/api-types.ts`: `onCommand(cb: (id: string) => void): () => void`.

- [ ] **Step 1: тесты (RED).**
  - `commands.test.ts`: `runCommand` вызывает зарегистрированную функцию и возвращает true; неизвестный id и снятая команда → false без исключения; заменённая регистрация: отписка старой не снимает новую; исключение в команде не ломает `runCommand` соседней (команда выбрасывает — `runCommand` возвращает false и не бросает).
  - `menuTemplate.test.ts`: шаблон обходится рекурсивно; (1) у каждого пункта с `click`, вызванным в тесте, `send` получает id из `COMMAND_IDS`; (2) все `COMMAND_IDS` присутствуют в меню; (3) метки на русском (есть кириллица) у всех пунктов без `role`; (4) ускорители: `open` `CmdOrCtrl+O`, `save` `CmdOrCtrl+S`, `save-as` `CmdOrCtrl+Shift+S`, `export-png` `CmdOrCtrl+E`, `export-pdf` `CmdOrCtrl+Shift+E`, `undo` `CmdOrCtrl+Z`, `redo` `CmdOrCtrl+Shift+Z`, `duplicate` `CmdOrCtrl+D`, `forward` `CmdOrCtrl+]`, `backward` `CmdOrCtrl+[`, `mode-fit` `CmdOrCtrl+1`, `mode-collage` `CmdOrCtrl+2`; (5) у пункта `delete` ускорителя нет и стоит `registerAccelerator: false`, метка показывает «⌫» через `sublabel`/текст (сочетание Delete держит рендерер); (6) в меню Правка есть роли `cut`, `copy`, `paste`, `selectAll`; (7) при `isMac:true` первое меню — приложения с ролями `about`, `hide`, `quit`.
- [ ] **Step 2:** запуск — Expected: FAIL.
- [ ] **Step 3: реализовать.** `commands.ts` — Map. `menu.ts` — только данные и тип `MenuItemConstructorOptions` из `electron` (import type), чтобы тест шёл без Electron. Меню: «Файл» (Открыть…, Сохранить, Сохранить как…, разделитель, Экспорт PNG…, Экспорт PDF…), «Правка» (Отменить, Повторить, разделитель, роли cut/copy/paste/selectAll), «Слой» (Дублировать, Поднять выше, Опустить ниже, Удалить), «Вид» (Подгонка, Коллаж, разделитель, роли `resetZoom`, `zoomIn`, `zoomOut`, `togglefullscreen`), «Окно» (роли `minimize`, `close`). В `main.ts`: `Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate(id => focusedWin?.webContents.send('menu:command', id), …)))` после `whenReady`; в `preload.ts` `onCommand` через `ipcRenderer.on('menu:command', …)` с возвратом отписки, id передаётся строкой.
- [ ] **Step 4:** оба файла тестов + `tsc` — Expected: PASS.
- [ ] **Step 5: commit** `feat(menu): russian app menu and command bus`.

### Task 4: Подключить команды и клавиши в интерфейсе

**Files:** Modify `src/app/App.tsx`, `src/modes/collage/CollageMode.tsx`, `src/modes/collage/ProjectBar.tsx`, `src/modes/collage/ExportBar.tsx`, `src/modes/fit/FitMode.tsx`; Test `tests/hotkeysWiring.test.ts` (логика без DOM-фреймворка: вынести обработчик в `src/modes/collage/layerHotkeys.ts` — `handleLayerKey(e: KeyboardEvent-подобный, store)`), живая проверка через CDP.

**Interfaces:**
- Consumes: Task 1 `layerKeyAction`, `isEditingTarget`, `ownsArrowKeys`; Task 2 хранилище; Task 3 `registerCommand`, `window.api.onCommand`.
- Produces: `handleLayerKey(e: KeyInfo & { target: EventTarget | null; preventDefault(): void }, store = useCollageStore): boolean`.

- [ ] **Step 1: тесты (RED)** `tests/hotkeysWiring.test.ts` на `handleLayerKey` с реальным `useCollageStore` (по образцу `collageStore.test.ts`): Delete с выбранным слоем удаляет его и возвращает true, `preventDefault` вызван; стрелка вправо сдвигает на 1 мм, Shift+стрелка на 10; Esc снимает выделение; цель — `<input type=text>` (создать `document.createElement`; если окружение vitest без DOM — подставить объект-заглушку с тем же `instanceof`-контрактом через `isEditingTarget`-стаб): ничего не меняется, false, `preventDefault` не вызван; цель `<input type=range>` и стрелка → false; без выделения → false.
  Также `registerCommand` дублирования/порядка: команды `duplicate/forward/backward/delete` из CollageMode при отсутствии выделения не меняют `collage.layers` (проверить через сторы напрямую вызовом функции `layerCommands(store)` — вынести в тот же файл как `layerCommands(): Record<'duplicate'|'forward'|'backward'|'delete', () => void>` и покрыть).
- [ ] **Step 2:** запуск — Expected: FAIL.
- [ ] **Step 3: реализовать.**
  - `layerHotkeys.ts`: `handleLayerKey` и `layerCommands`; команды работают с `selectedLayerId`, при его отсутствии выходят молча; при `isEditingTarget(document.activeElement)` команды `duplicate/forward/backward/delete` тоже молчат.
  - `CollageMode.tsx`: добавить к существующему обработчику ⌘Z вызов `handleLayerKey`; `useEffect` регистрирует `layerCommands()` и отписывается при размонтировании; также `undo`/`redo` (если фокус в текстовом поле → `document.execCommand('undo'|'redo')`, иначе стор).
  - `FitMode.tsx`: регистрирует `undo`/`redo` (с той же логикой поля ввода).
  - `ProjectBar.tsx`: регистрирует `save`, `save-as`, `open` теми же функциями, что клавиши.
  - `ExportBar.tsx`: регистрирует `export-png`/`export-pdf`, которые вызывают `run`, только если `!busy && blocked === null`; регистрация обновляется при смене этих значений (через ref на актуальный `run`).
  - `App.tsx`: регистрирует `mode-fit`/`mode-collage` (`setTab`); подписка `window.api?.onCommand(runCommand)` один раз.
  - Двойного срабатывания нет: все сочетания, которые уже ловит рендерер (⌘Z, ⌘S, ⇧⌘S, ⌘O), по-прежнему вызывают `preventDefault`.
- [ ] **Step 4:** весь набор `npm test`, `tsc` — Expected: PASS.
- [ ] **Step 5: живая проверка (CDP, dev-приложение):** отправить `Input.dispatchKeyEvent` для Delete/стрелок/Esc при выбранном слое: слой удалён/сдвинут на 1 мм и 10 мм/выделение снято; при фокусе в поле «DPI» стрелки и Delete слой не трогают; в режиме «Подгонка» клавиши без ошибок в консоли. Меню из CDP не проверяется (системное): проверяются шаблон тестом и `Menu.getApplicationMenu()` не через CDP — оставить ручной проверке.
- [ ] **Step 6: commit** `feat(hotkeys): layer keys, menu commands wired into the UI`.

### Task 5: Иконка

**Files:** Create `scripts/make-icon.mjs`, `build/icon.svg`, `build/icon.icns`; Modify `electron-builder.yml` (`mac.icon: build/icon.icns`), `package.json` (скрипт `icon`); Test `tests/icon.test.ts`.

**Interfaces:** Produces `build/icon.icns` (готовый артефакт в git).

- [ ] **Step 1: тесты (RED)** `tests/icon.test.ts`: `build/icon.icns` существует, начинается с байтов `icns`, размер > 20 КБ; `electron-builder.yml` содержит `icon: build/icon.icns`; `build/icon.svg` — валидный SVG с `viewBox="0 0 1024 1024"`, без `<script`/`href=` на внешние адреса.
- [ ] **Step 2:** запуск — Expected: FAIL.
- [ ] **Step 3: нарисовать** `build/icon.svg` (1024×1024, скруглённый квадрат macOS ~22% радиуса с отступом; тёплый фон, белая «фотокарточка» с уголками-держателями и полоской скотча — собственный рисунок, без шрифтов). `scripts/make-icon.mjs`: `@napi-rs/canvas` `loadImage(svg)` → PNG 1024 → `sips -z` в размеры 16–1024 (@1x/@2x) в `icon.iconset` во временной папке → `iconutil -c icns` → `build/icon.icns`. Запустить `node scripts/make-icon.mjs`. Посмотреть результат (`Read` PNG-превью) и поправить рисунок, пока читается в 16/32 px.
- [ ] **Step 4:** тест — Expected: PASS.
- [ ] **Step 5: commit** `feat(icon): app icon`.

### Task 6: Сборка, документация, живая проверка `.app`

**Files:** Modify `README.md`, `plan.md`.

- [ ] **Step 1:** `npm run dist` — Expected: EXIT 0; в `release/mac-arm64/PhotoMaker Studio.app/Contents/Resources` есть `icon.icns`, `Info.plist` содержит `CFBundleIconFile`.
- [ ] **Step 2:** запустить собранное `.app` с `--remote-debugging-port=9223`, повторить CDP-проверку клавиш из Task 4 Step 5 в упакованном приложении (узкий `pkill -f "release/mac-arm64/PhotoMaker Studio.app"`).
- [ ] **Step 3:** README: раздел «Горячие клавиши» таблицей; `plan.md`: этап 8 выполнен.
- [ ] **Step 4:** `npm test`, `tsc` — Expected: PASS; commit `docs: hotkeys and icon`.
- [ ] **Step 5:** финальное ревью всей ветки (opus), одна фикс-итерация, финальный отчёт «Rulings I made» / «Deferred minors»; в отчёте прямо сказать, что меню и ускорители проверены только тестом шаблона, а не нажатием в системном меню.
