import { build } from 'esbuild'

const common = { bundle: true, platform: 'node', target: 'node22', external: ['electron'], sourcemap: true }

await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist-electron/main.js', format: 'esm' })
// preload в песочнице Electron должен быть CommonJS
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist-electron/preload.cjs', format: 'cjs' })
