import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // 输出 .js / .d.ts（而非 .mjs / .d.mts），与 package.json 的 publishConfig 一致
  fixedExtension: false,
  dts: true,
  clean: true,
})
