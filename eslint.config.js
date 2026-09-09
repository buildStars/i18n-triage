import { defineConfig } from 'eslint/config'
import { base, noNodeIo } from '@i18n-triage/eslint-config'

export default defineConfig([
  ...base,
  // examples/ 是 CLI 的端到端 fixture，故意含有未使用变量、裸中文等，不按工程代码标准 lint
  { ignores: ['examples/**'] },
  // 分层原则：core 是零 IO 纯函数，禁止引入任何 Node IO 模块或使用 process 全局
  noNodeIo(['packages/core/src/**/*.ts']),
])
