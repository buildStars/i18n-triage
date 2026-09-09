import { mkdir, readFile as fsReadFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { FileContext, FixSkip, FixSkipReason } from '@i18n-triage/core'
import {
  createDefaultRules,
  excludeI18nCalls,
  parseSource,
  planFixes,
  triage,
} from '@i18n-triage/core'
import type { ReportError } from '@i18n-triage/reporters'
import { padEndDisplay } from '@i18n-triage/reporters'
import pc from 'picocolors'

import type { ResolvedConfig } from './config'
import { discoverFiles, toPosixRelative } from './discover'
import { isProbablyGenerated } from './scan'

export interface FixRunOptions {
  cwd: string
  config: ResolvedConfig
  /** 只规划不写盘 */
  dryRun?: boolean
  /** 测试注入：返回 undefined 则走默认的 fs 读取 */
  readFile?: (absPath: string) => Promise<string | undefined>
}

export interface FixFileDetail {
  file: string
  replaced: number
  skipped: FixSkip[]
}

export interface FixSummary {
  dryRun: boolean
  /** 扫描的文件数 */
  files: number
  /** 被改写（或 dry-run 下将被改写）的文件，posix 相对路径 */
  changedFiles: string[]
  replaced: number
  keysAdded: number
  /** 语言包路径（配置里的相对写法） */
  localeFile: string
  skippedByReason: Partial<Record<FixSkipReason, number>>
  details: FixFileDetail[]
  errors: ReportError[]
}

/** 把嵌套语言包压平成 `a.b.c` → 文案，用于复用已有 key */
function flattenLocale(value: unknown, prefix: string, out: Map<string, string>): void {
  if (typeof value === 'string') {
    if (prefix) out.set(prefix, value)
    return
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      flattenLocale(v, prefix ? `${prefix}.${k}` : k, out)
    }
  }
}

async function firstDirectory(paths: readonly string[], cwd: string): Promise<string> {
  for (const p of paths) {
    try {
      if ((await stat(path.resolve(cwd, p))).isDirectory()) return path.resolve(cwd, p)
    } catch {
      // 不存在的路径由 discoverFiles 报错
    }
  }
  return cwd
}

/**
 * `--fix`：发现文件 → 分类 → 规划编辑 → 写回源码 → 合并语言包。
 * 只改 A 类（规则命中；`fix.includeUnsure` 才连待确认一起改），其余原样不动。
 * 语言包按 JSON 读写：已有条目与嵌套结构保持不变，新 key 追加在顶层。
 */
export async function runFix(
  paths: readonly string[],
  options: FixRunOptions,
): Promise<FixSummary> {
  const { cwd, config } = options
  const dryRun = options.dryRun ?? false
  const fix = config.fix

  const files = await discoverFiles(paths, { cwd, config })
  const rootDir = await firstDirectory(paths.length > 0 ? paths : ['.'], cwd)
  const localeAbs = path.resolve(rootDir, fix.localeFile)

  let existingRaw: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(await fsReadFile(localeAbs, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      existingRaw = parsed as Record<string, unknown>
    }
  } catch {
    // 没有语言包：从空开始
  }
  const existingKeys = new Map<string, string>()
  flattenLocale(existingRaw, '', existingKeys)

  const rules = createDefaultRules(config.rulesConfig)
  const newKeys = new Map<string, string>()
  const changedFiles: string[] = []
  const details: FixFileDetail[] = []
  const errors: ReportError[] = []
  const skippedByReason: Partial<Record<FixSkipReason, number>> = {}
  let replaced = 0
  let scanned = 0

  for (const { absPath, relativePath } of files) {
    try {
      const source = (await options.readFile?.(absPath)) ?? (await fsReadFile(absPath, 'utf8'))
      if (isProbablyGenerated(source, config.maxFileSize) !== null) continue
      scanned++
      const ctx: FileContext = { relativePath }
      const results = triage(
        excludeI18nCalls(parseSource(source, ctx), config.i18nCallees),
        ctx,
        rules,
      )
      const plan = planFixes(source, ctx, results, {
        keyStyle: fix.keyStyle,
        templateFn: fix.templateFn,
        scriptFn: fix.scriptFn,
        fixPlainScripts: fix.fixPlainScripts,
        ensureUseI18n: fix.ensureUseI18n,
        includeUnsure: fix.includeUnsure,
        existingKeys,
      })

      for (const s of plan.skipped) skippedByReason[s.reason] = (skippedByReason[s.reason] ?? 0) + 1
      for (const [key, text] of plan.keys) {
        if (!existingKeys.has(key)) {
          existingKeys.set(key, text) // 后续文件复用同一个 key
          newKeys.set(key, text)
        }
      }
      details.push({ file: relativePath, replaced: plan.replaced, skipped: plan.skipped })
      replaced += plan.replaced

      if (plan.changed) {
        changedFiles.push(relativePath)
        if (!dryRun) await writeFile(absPath, plan.output, 'utf8')
      }
    } catch (err) {
      errors.push({ file: relativePath, message: err instanceof Error ? err.message : String(err) })
    }
  }

  if (!dryRun && newKeys.size > 0) {
    const merged: Record<string, unknown> = { ...existingRaw }
    for (const [key, text] of newKeys) merged[key] = text
    await mkdir(path.dirname(localeAbs), { recursive: true })
    await writeFile(localeAbs, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')
  }

  return {
    dryRun,
    files: scanned,
    changedFiles,
    replaced,
    keysAdded: newKeys.size,
    localeFile: toPosixRelative(rootDir, localeAbs),
    skippedByReason,
    details,
    errors,
  }
}

const REASON_HINT: Record<FixSkipReason, string> = {
  unsure: '待确认的 A（--include-unsure 可一并处理）',
  concatenation: '字符串拼接，整句改写会破坏语序',
  'template-literal': '模板字符串的静态段，需改成带插值参数的 t()',
  'no-t-in-scope': '非 <script setup> 里拿不到 t()（fix.fixPlainScripts + fix.scriptFn）',
  jsx: 'JSX 文本 / 属性暂不支持',
  'missing-range': '解析器没给出结束位置',
  unsupported: '属性写法不支持（无引号 / 带空格的 =）',
}

const fmt = (n: number): string => n.toLocaleString('en-US')

/** 终端文本摘要 */
export function formatFixSummary(summary: FixSummary, color = false): string {
  const c = pc.createColors(color)
  const lines: string[] = []
  const mode = summary.dryRun ? c.yellow('（dry-run，未写入任何文件）') : ''
  lines.push(
    `${c.bold('i18n-triage --fix')}  扫描 ${fmt(summary.files)} 个文件，改写 ${fmt(summary.changedFiles.length)} 个 ${mode}`.trimEnd(),
    '',
  )
  lines.push(`  ${padEndDisplay('替换文案', 14)}${fmt(summary.replaced).padStart(7)} 处`)
  lines.push(
    `  ${padEndDisplay('新增 key', 14)}${fmt(summary.keysAdded).padStart(7)} 个  → ${summary.localeFile}${summary.dryRun ? c.dim('（未写入）') : ''}`,
  )
  const skippedEntries = Object.entries(summary.skippedByReason) as [FixSkipReason, number][]
  const skippedTotal = skippedEntries.reduce((sum, [, n]) => sum + n, 0)
  lines.push(`  ${padEndDisplay('跳过', 14)}${fmt(skippedTotal).padStart(7)} 处`)
  skippedEntries.forEach(([reason, n], i) => {
    const branch = i === skippedEntries.length - 1 ? '└─' : '├─'
    lines.push(
      `    ${branch} ${reason.padEnd(18)}${fmt(n).padStart(5)}   ${c.dim(REASON_HINT[reason])}`,
    )
  })

  if (summary.changedFiles.length > 0) {
    lines.push(
      '',
      c.bold(
        `━━ ${summary.dryRun ? '将改写' : '已改写'}的文件（${fmt(summary.changedFiles.length)}）━━`,
      ),
    )
    for (const d of summary.details) {
      if (d.replaced > 0) lines.push(`  ${padEndDisplay(d.file, 40)}  ${fmt(d.replaced)} 处`)
    }
  }

  const withSkips = summary.details.filter((d) => d.skipped.length > 0)
  if (withSkips.length > 0) {
    lines.push('', c.bold(`━━ 跳过明细（${fmt(skippedTotal)}）━━`))
    for (const d of withSkips) {
      lines.push(`  ${c.underline(d.file)}`)
      for (const s of d.skipped) {
        const pos = `${s.node.loc.line}:${s.node.loc.column}`.padEnd(7)
        lines.push(`    ${pos}  ${padEndDisplay(`"${s.node.value}"`, 28)}  ${c.dim(s.reason)}`)
      }
    }
  }

  if (summary.errors.length > 0) {
    lines.push('', c.bold(c.red(`━━ 处理失败（${fmt(summary.errors.length)}）━━`)))
    for (const e of summary.errors) lines.push(`  ${e.file}  ${c.dim(e.message)}`)
  }

  return `${lines.join('\n')}\n`
}
