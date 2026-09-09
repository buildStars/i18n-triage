import { readFileSync } from 'node:fs'

import { defineConfig } from 'tsdown'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm'],
  platform: 'node',
  // 工作区包在开发期的 main 指向 src/*.ts，Node 直接跑 dist 时解析不到；
  // 把 core / reporters 打进 CLI 产物，第三方依赖（ts-morph、@vue/compiler-*、cac…）保持 external
  deps: { alwaysBundle: [/^@i18n-triage\//] },
  // 输出 .js / .d.ts（而非 .mjs / .d.mts），与 package.json 的 bin / publishConfig 一致
  fixedExtension: false,
  // core 的 index.ts 用了 export * 再导出，isolated 模式的 dts 插件跟不到，需要整程序 eager 发射。
  // eager 模式会为每个「不在 tsconfig 根文件列表里」的模块单独 new 一个 TS Program，
  // core / reporters 的几十个模块各建一个 Program（每个都要加载 ts-morph → typescript 的类型）
  // 会把默认 4 GB 堆撑爆；tsconfig.build.json 把这两个包的源码也列进 include，全程只建一个 Program。
  tsconfig: 'tsconfig.build.json',
  dts: { eager: true },
  // --version 与 SARIF tool.driver.version 用的版本号，来自 package.json
  define: { __VERSION__: JSON.stringify(pkg.version) },
  clean: true,
})
