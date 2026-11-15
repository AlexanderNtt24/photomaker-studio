const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * Записывает в PNG плотность печати (чанк pHYs, пикселей на метр): без неё Preview, Photoshop и
 * фотосалоны считают файл 72 dpi и показывают 10×15 см как ~42×62 см. Canvas.toBlob этот чанк не пишет.
 */
export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (png.length < 33 || SIGNATURE.some((b, i) => png[i] !== b)) throw new Error('Не PNG-файл')
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength)

  const ihdrEnd = 8 + 12 + dv.getUint32(8) // подпись + IHDR (длина, тип, данные, CRC)
  const rest: Uint8Array[] = []
  for (let o = ihdrEnd; o < png.length; ) {
    const len = dv.getUint32(o)
    const type = String.fromCharCode(png[o + 4], png[o + 5], png[o + 6], png[o + 7])
    if (type !== 'pHYs') rest.push(png.subarray(o, o + 12 + len))
    o += 12 + len
  }

  const ppm = Math.round(dpi / 0.0254)
  const chunk = new Uint8Array(21)
  const cdv = new DataView(chunk.buffer)
  cdv.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4) // "pHYs"
  cdv.setUint32(8, ppm)
  cdv.setUint32(12, ppm)
  chunk[16] = 1 // единица: метр
  cdv.setUint32(17, crc32(chunk.subarray(4, 17)))

  const out = new Uint8Array(ihdrEnd + chunk.length + rest.reduce((n, r) => n + r.length, 0))
  out.set(png.subarray(0, ihdrEnd), 0)
  out.set(chunk, ihdrEnd)
  let at = ihdrEnd + chunk.length
  for (const r of rest) {
    out.set(r, at)
    at += r.length
  }
  return out
}
