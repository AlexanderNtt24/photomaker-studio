/** brightness/contrast/saturation: −100..100; sharpen/blur/vignette/grain: 0..100 */
export type EffectParams = {
  brightness: number
  contrast: number
  saturation: number
  sharpen: number
  blur: number
  vignette: number
  grain: number
  grayscale: boolean
  sepia: boolean
}

export const NO_EFFECTS: EffectParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpen: 0,
  blur: 0,
  vignette: 0,
  grain: 0,
  grayscale: false,
  sepia: false,
}
