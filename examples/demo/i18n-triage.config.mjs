// 示例配置：默认会自动发现本文件。列表默认在内置白名单基础上追加（extendDefaults: true）。
// 在真实项目里推荐：import { defineConfig } from '@i18n-triage/cli' 以获得类型提示。
export default {
  // 额外把 data-track 之外的自定义展示属性算作 A
  displayAttrs: ['tip-text'],
  // 项目自己封装的提示函数
  uiApis: ['myToast'],
}
