import type { Api } from '../electron/api-types'

declare global {
  interface Window {
    api?: Api
  }
}
export {}
