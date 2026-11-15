import type { PhotoLayer } from '../../core/collage/model'

type Node = { x: number; y: number; width: number; height: number; scaleX: number; scaleY: number; rotation: number }

/** Пикселей на миллиметр так, чтобы лист целиком поместился в контейнер с отступом. */
export function stageScale(
  container: { width: number; height: number },
  sheetMm: { widthMm: number; heightMm: number },
  padding = 16,
): number {
  const w = Math.max(1, container.width - 2 * padding)
  const h = Math.max(1, container.height - 2 * padding)
  return Math.min(w / sheetMm.widthMm, h / sheetMm.heightMm)
}

/** Узел Konva с началом координат в центре слоя: поворот и масштаб идут вокруг центра. */
export function toNode(l: PhotoLayer, scale: number) {
  const width = l.widthMm * scale
  const height = l.heightMm * scale
  return {
    x: (l.xMm + l.widthMm / 2) * scale,
    y: (l.yMm + l.heightMm / 2) * scale,
    width,
    height,
    offsetX: width / 2,
    offsetY: height / 2,
    rotation: l.rotationDeg,
  }
}

export function fromNode(n: Node, scale: number): Pick<PhotoLayer, 'xMm' | 'yMm' | 'widthMm' | 'heightMm' | 'rotationDeg'> {
  const widthMm = (n.width * Math.abs(n.scaleX)) / scale
  const heightMm = (n.height * Math.abs(n.scaleY)) / scale
  return {
    xMm: n.x / scale - widthMm / 2,
    yMm: n.y / scale - heightMm / 2,
    widthMm,
    heightMm,
    rotationDeg: n.rotation,
  }
}
