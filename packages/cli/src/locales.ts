import { readFile as fsReadFile, stat } from 'node:fs/promises'
import path from 'node:path'

import type { FileContext, KeyUsages, LocaleAudit } from '@i18n-triage/core'
import {
  DEFAULT_I18N_CALLEES,
  auditLocales,
  findKeyUsages,
  flattenMessages,
} from '@i18n-triage/core'
import type { ReportError } from '@i18n-triage/reporters'
import { padEndDisplay } from '@i18n-triage/reporters'
import { createJiti } from 'jiti'
import pc from 'picocolors'
import { glob } from 'tinyglobby'

import type { ResolvedConfig } from './config'
import { discoverFiles, toPosixRelative } from './discover'
import { isProbablyGenerated } from './scan'

export interface LocaleFileInfo {
  /** posix 相对路径 */
  file: string
  locale: string
  /** `zh-CN/common.json` 这种目录布局下的命名空间（文件名） */
  namespace?: string
  keys: number
}

export interface LocalesResult {
  audit: LocaleAudit
  files: LocaleFileInfo[]
  codeFiles: number
  errors: ReportError[]
}

export interface LocalesRunOptions {
  cwd: string
  config: ResolvedConfig
}

/** 语言代码：zh、en、zh-CN、zh_CN、zh-Hans、en-US */
const LOCALE_ID = /^[a-z]{2}(?:[-_][A-Za-z]{2,4})?$/

/** 默认源语言找不到时依次尝试的写法 */
const SOURCE_FALLBACKS = ['zh_CN', 'zh-cn', 'zh-Hans', 'zh']

/**
 * 从路径判断这是哪个语言的语言包：
 * - `…/zh-CN.json`、`…/en.ts` → 文件名就是语言代码，整文件一个语言
 * - `…/zh-CN/common.json` → 上级目录是语言代码，文件名是命名空间
 * 其余（`index.ts`、`setup.ts`）不是语言包。
 */
export function detectLocaleFile(
  relativePath: string,
): { locale: string; namespace?: string } | undefined {
  const segments = relativePath.split(/[\\/]+/).filter((s) => s.length > 0)
  const base = segments[segments.length - 1] ?? ''
  const stem = base.replace(/\.[^.]+$/, '')
  if (LOCALE_ID.test(stem)) return { locale: stem, namespace: undefined }
  const parent = segments[segments.length - 2]
  if (parent !== undefined && LOCALE_ID.test(parent)) return { locale: parent, namespace: stem }
  return undefined
}

async function loadMessages(absPath: string): Promise<unknown> {
  if (absPath.endsWith('.json')) return JSON.parse(await fsReadFile(absPath, 'utf8')) as unknown
  const jiti = createJiti(import.meta.url, { interopDefault: true })
  return jiti.import(absPath, { default: true })
}

async function firstDirectory(paths: readonly string[], cwd: string): Promise<string> {
  for (const p of paths) {
    try {
      if ((await stat(path.resolve(cwd, p))).isDirectory()) return path.resolve(cwd, p)
    } catch {
      // 交给 discoverFiles 报错
    }
  }
  return cwd
}

/**
 * `i18n-triage locales`：
 * 1. 按 config.locales.files 找语言包，按语言 / 命名空间合并压平
 * 2. 扫描代码里的 i18n 调用，收集 key 引用
 * 3. 以源语言为基准审计完整度、死 key、未定义 key
 */
export async function runLocales(
  paths: readonly string[],
  options: LocalesRunOptions,
): Promise<LocalesResult> {
  const { cwd, config } = options
  const errors: ReportError[] = []
  const rootDir = await firstDirectory(paths.length > 0 ? paths : ['.'], cwd)

  // ---- 语言包 ----
  const matched = await glob(config.locales.files, {
    cwd: rootDir,
    ignore: ['**/node_modules/**', '**/dist/**'],
    absolute: true,
    onlyFiles: true,
  })
  const locales = new Map<string, Map<string, string>>()
  const files: LocaleFileInfo[] = []
  for (const abs of matched.map((f) => path.normalize(f)).sort()) {
    const relativePath = toPosixRelative(rootDir, abs)
    const detected = detectLocaleFile(relativePath)
    if (!detected) continue
    try {
      const flat = flattenMessages(await loadMessages(abs), detected.namespace ?? '')
      const bucket = locales.get(detected.locale) ?? new Map<string, string>()
      for (const [k, v] of flat) bucket.set(k, v)
      locales.set(detected.locale, bucket)
      files.push({
        file: relativePath,
        locale: detected.locale,
        ...(detected.namespace !== undefined ? { namespace: detected.namespace } : {}),
        keys: flat.size,
      })
    } catch (err) {
      errors.push({ file: relativePath, message: err instanceof Error ? err.message : String(err) })
    }
  }
  files.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))

  // ---- 源语言 ----
  const wanted = config.locales.source
  const candidates = wanted === 'zh-CN' ? [wanted, ...SOURCE_FALLBACKS] : [wanted]
  const sourceLocale = candidates.find((c) => locales.has(c))
  if (sourceLocale === undefined) {
    errors.push({
      file: rootDir === cwd ? '.' : toPosixRelative(cwd, rootDir),
      message: `找不到源语言 ${wanted} 的语言包（发现的语言：${[...locales.keys()].join(', ') || '无'}）`,
    })
  }
  const source =
    sourceLocale !== undefined
      ? (locales.get(sourceLocale) ?? new Map())
      : new Map<string, string>()
  const targets = new Map<string, ReadonlyMap<string, string>>()
  for (const [locale, messages] of locales)
    if (locale !== sourceLocale) targets.set(locale, messages)

  // ---- 代码引用 ----
  const codeFiles = await discoverFiles(paths, { cwd, config })
  const usages: KeyUsages = { static: [], dynamic: [], literals: [] }
  const literals = new Set<string>()
  const callees =
    config.locales.callees.length > 0
      ? [...DEFAULT_I18N_CALLEES, ...config.locales.callees]
      : undefined
  let scanned = 0
  for (const { absPath, relativePath } of codeFiles) {
    try {
      const code = await fsReadFile(absPath, 'utf8')
      if (isProbablyGenerated(code, config.maxFileSize) !== null) continue
      scanned++
      const ctx: FileContext = { relativePath }
      const found = findKeyUsages(code, ctx, { callees, keyAttrs: config.locales.keyAttrs })
      usages.static.push(...found.static)
      usages.dynamic.push(...found.dynamic)
      for (const l of found.literals) literals.add(l)
    } catch (err) {
      errors.push({ file: relativePath, message: err instanceof Error ? err.message : String(err) })
    }
  }

  usages.literals = [...literals]
  const audit = auditLocales({ sourceLocale: sourceLocale ?? wanted, source, targets, usages })
  return { audit, files, codeFiles: scanned, errors }
}

/** 缺失 / 空值 / 未定义 key / 运行错误 → 1，可直接当 CI 门禁 */
export function localesExitCode(result: LocalesResult): 0 | 1 {
  const { audit, errors } = result
  const incomplete = audit.diffs.some((d) => d.missing.length > 0 || d.empty.length > 0)
  return errors.length > 0 || incomplete || audit.undefined.length > 0 ? 1 : 0
}

const fmt = (n: number): string => n.toLocaleString('en-US')
const LIST_LIMIT = 50

export function formatLocalesText(result: LocalesResult, color = false): string {
  const c = pc.createColors(color)
  const { audit, files, codeFiles, errors } = result
  const lines: string[] = []

  lines.push(
    `${c.bold('i18n-triage locales')}  源语言 ${audit.sourceLocale}（${fmt(audit.sourceKeys)} 个 key），对比 ${fmt(audit.diffs.length)} 个语言包，扫描 ${fmt(codeFiles)} 个代码文件`,
    '',
  )

  lines.push(c.bold('━━ 完整度 ━━'))
  if (audit.diffs.length === 0) lines.push(`  ${c.dim('（没有其他语言包）')}`)
  for (const d of audit.diffs) {
    const pct = d.sourceKeys > 0 ? ((d.translated / d.sourceKeys) * 100).toFixed(1) : '0.0'
    const flag = d.missing.length > 0 || d.empty.length > 0 ? c.yellow : c.green
    lines.push(
      `  ${padEndDisplay(d.locale, 10)} 缺失 ${flag(fmt(d.missing.length).padStart(4))}   多余 ${fmt(d.extra.length).padStart(4)}   空值 ${flag(fmt(d.empty.length).padStart(4))}   ${c.dim(`（${fmt(d.translated)}/${fmt(d.sourceKeys)} = ${pct}%）`)}`,
    )
  }
  const details = audit.diffs.filter(
    (d) => d.missing.length > 0 || d.empty.length > 0 || d.extra.length > 0,
  )
  if (details.length > 0) {
    lines.push(`  ${c.dim(`明细（每类最多 ${LIST_LIMIT} 条）`)}`)
    for (const d of details) {
      if (d.missing.length > 0)
        lines.push(`    ${d.locale} 缺失：${d.missing.slice(0, LIST_LIMIT).join(', ')}`)
      if (d.empty.length > 0)
        lines.push(`    ${d.locale} 空值：${d.empty.slice(0, LIST_LIMIT).join(', ')}`)
      if (d.extra.length > 0)
        lines.push(`    ${d.locale} 多余：${d.extra.slice(0, LIST_LIMIT).join(', ')}`)
    }
  }

  lines.push(
    '',
    c.bold(`━━ 死 key（${fmt(audit.dead.length)}）━━`) + `  ${c.dim('源语言里定义、代码从未引用')}`,
  )
  if (audit.dead.length === 0) lines.push(`  ${c.dim('（无）')}`)
  for (const key of audit.dead.slice(0, LIST_LIMIT)) lines.push(`  ${key}`)
  if (audit.dead.length > LIST_LIMIT)
    lines.push(`  ${c.dim(`… 还有 ${fmt(audit.dead.length - LIST_LIMIT)} 个`)}`)

  if (audit.maybeUsed.length > 0) {
    lines.push(
      '',
      c.bold(`━━ 可能被动态使用（${fmt(audit.maybeUsed.length)}）━━`) +
        `  ${c.dim('匹配动态调用的前缀，未按死 key 处理')}`,
    )
    for (const m of audit.maybeUsed.slice(0, LIST_LIMIT))
      lines.push(`  ${padEndDisplay(m.key, 40)}  ← ${m.prefix}`)
  }

  if (audit.referencedAsLiteral.length > 0) {
    lines.push(
      '',
      c.bold(`━━ 可能通过字面量引用（${fmt(audit.referencedAsLiteral.length)}）━━`) +
        `  ${c.dim('有字符串字面量恰好等于 key（路由 meta.title、菜单配置），未按死 key 处理')}`,
    )
    for (const key of audit.referencedAsLiteral.slice(0, LIST_LIMIT)) lines.push(`  ${key}`)
    if (audit.referencedAsLiteral.length > LIST_LIMIT) {
      lines.push(`  ${c.dim(`… 还有 ${fmt(audit.referencedAsLiteral.length - LIST_LIMIT)} 个`)}`)
    }
  }

  lines.push(
    '',
    c.bold(`━━ 未定义 key（${fmt(audit.undefined.length)}）━━`) +
      `  ${c.dim('代码引用了、源语言里没有')}`,
  )
  if (audit.undefined.length === 0) lines.push(`  ${c.dim('（无）')}`)
  for (const u of audit.undefined.slice(0, LIST_LIMIT)) {
    lines.push(`  ${padEndDisplay(`${u.loc.file}:${u.loc.line}`, 44)}  ${c.red(u.key)}`)
  }

  if (audit.dynamicWithoutPrefix > 0) {
    lines.push(
      '',
      `  ${c.yellow(`注意：${fmt(audit.dynamicWithoutPrefix)} 处动态调用没有静态前缀（t(key) 之类），死 key 判定可能偏多`)}`,
    )
  }

  if (errors.length > 0) {
    lines.push('', c.bold(c.red(`━━ 错误（${fmt(errors.length)}）━━`)))
    for (const e of errors) lines.push(`  ${e.file}  ${c.dim(e.message)}`)
  }

  lines.push('', c.dim(`语言包文件：${files.map((f) => f.file).join(', ') || '无'}`))
  return `${lines.join('\n')}\n`
}

export function formatLocalesJson(result: LocalesResult): string {
  return JSON.stringify({ schemaVersion: 1, ...result }, null, 2)
}
