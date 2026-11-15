export type Rect = { x: number; y: number; width: number; height: number }
/** zoom ≥ 1; cx, cy — центр рамки в долях 0..1 от размеров изображения */
export type CropState = { zoom: number; cx: number; cy: number }

export const DEFAULT_CROP: CropState = { zoom: 1, cx: 0.5, cy: 0.5 }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

export function cropRect(imgW: number, imgH: number, targetRatio: number, s: CropState): Rect {
  const zoom = Math.max(1, s.zoom)
  let w: number
  let h: number
  if (imgW / imgH > targetRatio) {
    h = imgH
    w = h * targetRatio
  } else {
    w = imgW
    h = w / targetRatio
  }
  w /= zoom
  h /= zoom
  return {
    x: clamp(s.cx * imgW - w / 2, 0, imgW - w),
    y: clamp(s.cy * imgH - h / 2, 0, imgH - h),
    width: w,
    height: h,
  }
}

export function containRect(imgW: number, imgH: number, boxW: number, boxH: number): Rect {
  const k = Math.min(boxW / imgW, boxH / imgH)
  const width = imgW * k
  const height = imgH * k
  return { x: (boxW - width) / 2, y: (boxH - height) / 2, width, height }
}
