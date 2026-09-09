import { access, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Category, RulesConfig } from '@i18n-triage/core'
import {
  DEFAULT_DEBUG_APIS,
  DEFAULT_DICT_DIRS,
  DEFAULT_DICT_SIBLING_THRESHOLD,
  DEFAULT_DISPLAY_ATTRS,
  DEFAULT_I18N_CALLEES,
  DEFAULT_INTERNAL_ATTRS,
  DEFAULT_UI_APIS,
} from '@i18n-triage/core'
import { CATEGORIES, CATEGORY_BY_LETTER, DEFAULT_ONLY } from '@i18n-triage/reporters'
import { createJiti } from 'jiti'

export type OutputFormat = 'text' | 'json' | 'sarif'

/** `--fix` 的选项（配置文件 `fix` 字段） */
export interface FixConfig {
  /** key 生成策略：'text'（默认，中文即 key）| 'hash' */
  keyStyle?: 'text' | 'hash'
  /** 模板里的翻译函数，默认 `$t` */
  templateFn?: string
  /** 脚本里的翻译函数，默认 `t` */
  scriptFn?: string
  /** 也改写非 `<script setup>` 的脚本（options API、.ts / .js），假定 scriptFn 在作用域内；默认 false */
  fixPlainScripts?: boolean
  /** `<script setup>` 缺 `t` 时自动补 useI18n，默认 true */
  ensureUseI18n?: boolean
  /** 连「待确认」的 A 类也改写，默认 false */
  includeUnsure?: boolean
  /** 语言包文件路径，相对被扫描的目录（多目标时取第一个；没有目录目标时相对 cwd），默认 src/locales/zh-CN.json */
  localeFile?: string
}

export type ResolvedFixConfig = Required<FixConfig>

/** `i18n-triage locales` 的选项（配置文件 `locales` 字段） */
export interface LocalesConfig {
  /** 语言包文件 glob；文件名或上级目录名必须是语言代码（zh-CN.json、zh-CN/common.json） */
  files?: string[]
  /** 源语言，默认 zh-CN（找不到时依次尝试 zh_CN / zh-Hans / zh，再退回第一个） */
  source?: string
  /** 识别为 i18n 调用的被调用者模式，默认与剔除 t() 的列表相同 */
  callees?: string[]
  /** 模板里直接写 key 的属性，默认 keypath / path */
  keyAttrs?: string[]
}

export type ResolvedLocalesConfig = Required<LocalesConfig>

export const DEFAULT_LOCALES_CONFIG: ResolvedLocalesConfig = {
  files: [
    '**/locales/**/*.{json,ts,js,mjs,cjs}',
    '**/locale/**/*.{json,ts,js,mjs,cjs}',
    '**/lang/**/*.{json,ts,js,mjs,cjs}',
    '**/langs/**/*.{json,ts,js,mjs,cjs}',
    '**/i18n/**/*.{json,ts,js,mjs,cjs}',
  ],
  source: 'zh-CN',
  callees: [],
  keyAttrs: ['keypath', 'path'],
}

export const DEFAULT_FIX_CONFIG: ResolvedFixConfig = {
  keyStyle: 'text',
  templateFn: '$t',
  scriptFn: 't',
  fixPlainScripts: false,
  ensureUseI18n: true,
  includeUnsure: false,
  localeFile: 'src/locales/zh-CN.json',
}

/** 用户在 i18n-triage.config.{ts,js,mjs,json} 里写的配置 */
export interface I18nTriageConfig {
  /** 扫描的 glob，默认 `['**\/*.{vue,ts,js,tsx,jsx}']` */
  include?: string[]
  /** 额外排除的 glob；始终在默认排除（node_modules / dist / .git / coverage）之上追加 */
  ignore?: string[]
  /** A：展示类属性白名单 */
  displayAttrs?: string[]
  /** A：UI 提示 API（模式语法见 core 的 callee-match） */
  uiApis?: string[]
  /** B：调试 / 日志 API */
  debugApis?: string[]
  /** C：字典目录名 */
  dictDirs?: string[]
  /** C：同一对象里含中文 value 的最低个数，默认 3 */
  dictSiblingThreshold?: number
  /** 已接入 i18n 的调用，实参整体剔除 */
  i18nCallees?: string[]
  /** D：值永远不是文案的模板属性（id / fill / data-* …） */
  internalAttrs?: string[]
  /** true（默认）：上面各列表追加到内置白名单之后；false：整体替换 */
  extendDefaults?: boolean
  /** 超过多少字节的文件视为生成物跳过，默认 300000 */
  maxFileSize?: number
  /** 只显示哪些类别：'A,C' 这样的字母串，或 Category 数组；默认 A,C */
  only?: string | Category[]
  /** 输出格式，默认 text */
  format?: OutputFormat
  /** `--fix` 的选项 */
  fix?: FixConfig
  /** `i18n-triage locales` 的选项 */
  locales?: LocalesConfig
}

export interface ResolvedConfig {
  include: string[]
  ignore: string[]
  rulesConfig: RulesConfig
  i18nCallees: readonly string[]
  only: Category[]
  format: OutputFormat
  dictSiblingThreshold: number
  maxFileSize: number
  fix: ResolvedFixConfig
  locales: ResolvedLocalesConfig
}

export const DEFAULT_INCLUDE: readonly string[] = ['**/*.{vue,ts,js,tsx,jsx}']

/**
 * 默认排除。除了构建 / 依赖目录，还有 Day 7 在真实项目上验证出的三类噪音源：
 * - 翻译表本身（locales/、zh-CN.ts、bpmn 的 translate/zh.js）——它们是翻译的目标，不是硬编码来源
 * - mock 数据与测试（`it('应该…')` 的描述不是 UI 文案）
 * - 压缩 / 打包产物（`*.min.js`、`*.umd.js`）与类型声明
 */
/**
 * mock / 测试文件：里面的中文不是待翻译的硬编码文案，主命令默认不扫；
 * 但 `locales` 子命令要扫——菜单、图表数据常由 mock 接口下发，key 只出现在 mock 里也算「还在用」。
 */
export const DEFAULT_IGNORE_MOCK_TESTS: readonly string[] = [
  '**/mock/**',
  '**/mocks/**',
  '**/__mocks__/**',
  '**/__tests__/**',
  '**/*.test.*',
  '**/*.spec.*',
]

export const DEFAULT_IGNORE: readonly string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/coverage/**',
  // 翻译表
  '**/locales/**',
  '**/locale/**',
  '**/lang/**',
  '**/langs/**',
  '**/i18n/**',
  '**/translations/**',
  '**/translate/**',
  '**/zh-CN.*',
  '**/zh_CN.*',
  '**/zh-cn.*',
  '**/zh-Hans.*',
  '**/zh-TW.*',
  '**/zh-HK.*',
  '**/zh.*',
  // mock / 测试
  ...DEFAULT_IGNORE_MOCK_TESTS,
  // 产物
  '**/*.min.js',
  '**/*.umd.js',
  '**/*.umd.cjs',
  '**/*.iife.js',
  '**/*.d.ts',
]

/** 超过这个字节数的文件视为生成物，跳过不扫（yudao 里 vendored 的 Tinyflow 打包产物 506 KB） */
export const DEFAULT_MAX_FILE_SIZE = 300_000

/** 仅用于给配置文件提供类型提示 */
export function defineConfig(config: I18nTriageConfig): I18nTriageConfig {
  return config
}

/** `'A,C'` → Category[]；`'all'` → 全部四类 */
export function parseOnly(input: string): Category[] {
  const trimmed = input.trim()
  if (trimmed.toLowerCase() === 'all') return [...CATEGORIES]
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((letter) => {
      const upper = letter.toUpperCase()
      const category = isLetter(upper) ? CATEGORY_BY_LETTER[upper] : undefined
      if (!category) throw new Error(`未知类别 "${letter}"，--only 只接受 A / B / C / D 或 all`)
      return category
    })
}

function isLetter(s: string): s is 'A' | 'B' | 'C' | 'D' {
  return s === 'A' || s === 'B' || s === 'C' || s === 'D'
}

/** 把用户配置与内置默认值合并成引擎可直接使用的配置 */
export function resolveConfig(user: I18nTriageConfig = {}): ResolvedConfig {
  const extend = user.extendDefaults ?? true
  const merge = (defaults: readonly string[], custom?: string[]): string[] | undefined => {
    if (custom === undefined) return undefined
    return extend ? [...defaults, ...custom] : [...custom]
  }

  const rulesConfig: RulesConfig = {}
  const displayAttrs = merge(DEFAULT_DISPLAY_ATTRS, user.displayAttrs)
  if (displayAttrs) rulesConfig.displayAttrs = displayAttrs
  const uiApis = merge(DEFAULT_UI_APIS, user.uiApis)
  if (uiApis) rulesConfig.uiApis = uiApis
  const debugApis = merge(DEFAULT_DEBUG_APIS, user.debugApis)
  if (debugApis) rulesConfig.debugApis = debugApis
  const dictDirs = merge(DEFAULT_DICT_DIRS, user.dictDirs)
  if (dictDirs) rulesConfig.dictDirs = dictDirs
  const internalAttrs = merge(DEFAULT_INTERNAL_ATTRS, user.internalAttrs)
  if (internalAttrs) rulesConfig.internalAttrs = internalAttrs
  if (user.dictSiblingThreshold !== undefined) {
    rulesConfig.dictSiblingThreshold = user.dictSiblingThreshold
  }

  const only =
    user.only === undefined
      ? [...DEFAULT_ONLY]
      : typeof user.only === 'string'
        ? parseOnly(user.only)
        : [...user.only]

  return {
    include: [...(user.include ?? DEFAULT_INCLUDE)],
    ignore: [...DEFAULT_IGNORE, ...(user.ignore ?? [])],
    rulesConfig,
    i18nCallees: merge(DEFAULT_I18N_CALLEES, user.i18nCallees) ?? DEFAULT_I18N_CALLEES,
    only,
    format: user.format ?? 'text',
    dictSiblingThreshold: user.dictSiblingThreshold ?? DEFAULT_DICT_SIBLING_THRESHOLD,
    maxFileSize: user.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
    fix: { ...DEFAULT_FIX_CONFIG, ...stripUndefined(user.fix ?? {}) },
    locales: { ...DEFAULT_LOCALES_CONFIG, ...stripUndefined(user.locales ?? {}) },
  }
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  return out
}

const CONFIG_FILE_NAMES = [
  'i18n-triage.config.ts',
  'i18n-triage.config.mts',
  'i18n-triage.config.js',
  'i18n-triage.config.mjs',
  'i18n-triage.config.cjs',
  'i18n-triage.config.json',
]

export interface LoadedConfig {
  path: string
  config: I18nTriageConfig
}

/**
 * 加载配置文件。查找顺序：
 * 1. explicitPath（给了就只认它，不存在则报错）
 * 2. cwd 下按 CONFIG_FILE_NAMES 顺序
 * 3. fallbackDirs（通常是命令行给的目标目录），按给定顺序
 * 都没有返回 undefined。
 */
export async function loadConfigFile(
  cwd: string,
  explicitPath?: string,
  fallbackDirs: readonly string[] = [],
): Promise<LoadedConfig | undefined> {
  if (explicitPath !== undefined) {
    const abs = path.resolve(cwd, explicitPath)
    if (!(await exists(abs))) throw new Error(`配置文件不存在：${abs}`)
    return { path: abs, config: await importConfig(abs) }
  }
  for (const dir of [cwd, ...fallbackDirs.map((d) => path.resolve(cwd, d))]) {
    for (const name of CONFIG_FILE_NAMES) {
      const abs = path.join(dir, name)
      if (await exists(abs)) return { path: abs, config: await importConfig(abs) }
    }
  }
  return undefined
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function importConfig(abs: string): Promise<I18nTriageConfig> {
  let loaded: unknown
  if (abs.endsWith('.json')) {
    loaded = JSON.parse(await readFile(abs, 'utf8'))
  } else {
    const jiti = createJiti(import.meta.url, { interopDefault: true })
    loaded = await jiti.import(abs, { default: true })
  }
  if (typeof loaded !== 'object' || loaded === null || Array.isArray(loaded)) {
    throw new Error(`配置文件必须导出一个对象：${abs}`)
  }
  return loaded as I18nTriageConfig
}
