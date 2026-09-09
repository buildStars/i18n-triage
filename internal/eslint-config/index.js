import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * Node 内置 IO / 运行时模块。`packages/core` 必须是零 IO 纯函数，
 * 这些模块（含 `node:` 前缀写法）一律禁止在 core 中引入。
 */
const NODE_IO_MODULES = [
  'fs',
  'fs/promises',
  'path',
  'path/posix',
  'path/win32',
  'process',
  'child_process',
  'os',
  'net',
  'http',
  'https',
  'http2',
  'dgram',
  'dns',
  'readline',
  'tty',
  'worker_threads',
  'cluster',
  'vm',
  'v8',
  'inspector',
]

const restrictedNodeIoPaths = NODE_IO_MODULES.flatMap((name) => [
  { name, message: `core 是零 IO 纯函数，禁止引入 "${name}"；所有 IO 放到 packages/cli` },
  {
    name: `node:${name}`,
    message: `core 是零 IO 纯函数，禁止引入 "node:${name}"；所有 IO 放到 packages/cli`,
  },
])

/** 全仓库通用的基础配置 */
export const base = [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.turbo/**'],
  },
  js.configs.recommended,
  {
    // 纯 JS 文件（eslint.config.js、tsdown/vitest 配置、scripts/ 下的开发脚本）跑在 Node 上
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: { ...globals.nodeBuiltin } },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: {
      // 禁止 any：必要时用 unknown + 类型守卫
      '@typescript-eslint/no-explicit-any': 'error',
      // 禁止 @ts-ignore；@ts-expect-error 必须附说明
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 6,
        },
      ],
      // 配合 verbatimModuleSyntax：类型导入必须用 import type
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
]

/**
 * 零 IO 约束：应用到指定文件（通常是 `packages/core/src/**`），
 * 禁止引入 Node IO 模块，并禁止使用 `process` 全局。
 *
 * @param {string[]} files glob 列表
 */
export function noNodeIo(files) {
  return {
    files,
    rules: {
      'no-restricted-imports': ['error', { paths: restrictedNodeIoPaths }],
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'core 是零 IO 纯函数，禁止使用 process 全局' },
        { name: '__dirname', message: 'core 是零 IO 纯函数，禁止使用 __dirname' },
        { name: '__filename', message: 'core 是零 IO 纯函数，禁止使用 __filename' },
      ],
    },
  }
}
