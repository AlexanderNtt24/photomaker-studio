/** Стартовый набор: простые векторные рисунки, нарисованные для этого приложения (чужих материалов нет). */
export type BuiltinSticker = { id: string; label: string; svg: string; aspect: number }

const NS = 'xmlns="http://www.w3.org/2000/svg"'

function make(id: string, label: string, w: number, h: number, body: string): BuiltinSticker {
  return { id, label, aspect: w / h, svg: `<svg ${NS} viewBox="0 0 ${w} ${h}">${body}</svg>` }
}

const arrowHead = (x: number, y: number, rot: number, c: string) =>
  `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 0 L-14 -9 M0 0 L-14 9" stroke="${c}" stroke-width="5" stroke-linecap="round" fill="none"/>`

export const BUILTIN_STICKERS: BuiltinSticker[] = [
  make(
    'tape-yellow',
    'Скотч жёлтый',
    120,
    40,
    '<path d="M4 4 L10 10 L4 16 L10 22 L4 28 L10 34 L4 36 L116 36 L110 30 L116 24 L110 18 L116 12 L110 6 L116 4 Z" fill="#f6d85a" fill-opacity="0.8"/><path d="M20 12 H100 M20 20 H100 M20 28 H100" stroke="#fff" stroke-opacity="0.35" stroke-width="2"/>',
  ),
  make(
    'tape-pink',
    'Скотч розовый',
    120,
    40,
    '<rect x="4" y="4" width="112" height="32" fill="#f4a6c0" fill-opacity="0.8"/><path d="M4 4 L12 8 L4 12 L12 16 L4 20 L12 24 L4 28 L12 32 L4 36 M116 4 L108 8 L116 12 L108 16 L116 20 L108 24 L116 28 L108 32 L116 36" stroke="#fff" stroke-opacity="0.6" stroke-width="2" fill="none"/><circle cx="30" cy="20" r="4" fill="#fff" fill-opacity="0.6"/><circle cx="60" cy="20" r="4" fill="#fff" fill-opacity="0.6"/><circle cx="90" cy="20" r="4" fill="#fff" fill-opacity="0.6"/>',
  ),
  make(
    'arrow-straight',
    'Стрелка прямая',
    120,
    40,
    `<path d="M10 20 H108" stroke="#444" stroke-width="5" stroke-linecap="round" fill="none"/>${arrowHead(110, 20, 0, '#444')}`,
  ),
  make(
    'arrow-curved',
    'Стрелка дугой',
    120,
    60,
    `<path d="M10 50 Q55 -5 104 34" stroke="#444" stroke-width="5" stroke-linecap="round" fill="none"/>${arrowHead(106, 36, 40, '#444')}`,
  ),
  make(
    'arrow-loop',
    'Стрелка с петлёй',
    120,
    60,
    `<path d="M8 46 C30 46 40 10 58 22 C74 34 52 50 44 30 C38 14 80 8 106 30" stroke="#444" stroke-width="4" stroke-linecap="round" fill="none"/>${arrowHead(108, 32, 35, '#444')}`,
  ),
  make(
    'star',
    'Звезда',
    80,
    80,
    '<path d="M40 6 L49 30 L74 31 L54 47 L61 72 L40 58 L19 72 L26 47 L6 31 L31 30 Z" fill="#f4c542" stroke="#d99a1c" stroke-width="3" stroke-linejoin="round"/>',
  ),
  make(
    'heart',
    'Сердце',
    80,
    72,
    '<path d="M40 68 C8 44 4 28 12 16 C22 4 36 10 40 22 C44 10 58 4 68 16 C76 28 72 44 40 68 Z" fill="#e8587a" stroke="#b83a58" stroke-width="3" stroke-linejoin="round"/>',
  ),
  make(
    'shell',
    'Ракушка',
    80,
    80,
    '<path d="M40 72 C14 62 6 36 14 22 C24 6 56 6 66 22 C74 36 66 62 40 72 Z" fill="#f2d3b3" stroke="#c99a6d" stroke-width="3" stroke-linejoin="round"/><path d="M40 72 L40 14 M40 72 L22 18 M40 72 L58 18 M40 72 L12 32 M40 72 L68 32" stroke="#c99a6d" stroke-width="2.5" stroke-linecap="round" fill="none"/>',
  ),
  make(
    'corners',
    'Уголки для фото',
    100,
    100,
    '<path d="M4 30 V4 H30 M70 4 H96 V30 M96 70 V96 H70 M30 96 H4 V70" stroke="#555" stroke-width="6" stroke-linecap="square" fill="none"/>',
  ),
  make(
    'stamp',
    'Штамп',
    100,
    100,
    '<circle cx="50" cy="50" r="44" fill="none" stroke="#a33b3b" stroke-width="5"/><circle cx="50" cy="50" r="35" fill="none" stroke="#a33b3b" stroke-width="2"/><path d="M50 24 L56 42 L75 42 L60 53 L66 71 L50 60 L34 71 L40 53 L25 42 L44 42 Z" fill="#a33b3b"/>',
  ),
  make(
    'cloud',
    'Облачко',
    120,
    80,
    '<path d="M32 66 C10 66 6 40 26 36 C24 16 52 8 62 26 C74 10 102 22 94 42 C112 44 112 66 92 66 Z" fill="#ffffff" stroke="#8fb4d8" stroke-width="4" stroke-linejoin="round"/>',
  ),
  make(
    'wave',
    'Волна',
    140,
    40,
    '<path d="M6 20 Q22 2 38 20 T70 20 T102 20 T134 20" stroke="#3f8fc4" stroke-width="6" stroke-linecap="round" fill="none"/>',
  ),
]

export const builtinById = (id: string): BuiltinSticker | undefined => BUILTIN_STICKERS.find((s) => s.id === id)
