import { defineConfig } from 'eslint/config'
import { base, noNodeIo } from '@i18n-triage/eslint-config'

export default defineConfig([
  ...base,
  // 分层原则：core 是零 IO 纯函数，禁止引入任何 Node IO 模块或使用 process 全局
  noNodeIo(['packages/core/src/**/*.ts']),
])
