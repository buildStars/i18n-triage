import type { Category, TriageResult } from '@i18n-triage/core'
import pc from 'picocolors'

import { CATEGORIES, CATEGORY_LABEL, DEFAULT_ONLY } from './categories'
import { displayWidth, padEndDisplay, truncateDisplay } from './display-width'
import type { ScanReport } from './report-model'

export interface TextReporterOptions {
  /** 展示哪些类别的明细，默认 A 与 C */
  only?: readonly Category[]
  /** 是否输出 ANSI 颜色，默认 false（由 cli 根据 TTY 决定） */
  color?: boolean
  /** C 类提示语里显示的阈值，默认 3 */
  dictSiblingThreshold?: number
}

type Colors = ReturnType<typeof pc.createColors>

const LABEL_WIDTH = 24
const VALUE_WIDTH = 28
const VALUE_MAX = 24
const KIND_WIDTH = 14
const CONTEXT_WIDTH = 18

const fmt = (n: number): string => n.toLocaleString('en-US')
const num = (n: number): string => fmt(n).padStart(7)
/** 摘要行标签：带 `├─ ` 前缀的行少补 3 格，保证数字列对齐 */
const label = (s: string, prefixWidth = 0): string => padEndDisplay(s, LABEL_WIDTH - prefixWidth)
const TREE_PREFIX_WIDTH = 3

/** 终端文本报告。核心是「降噪比」那一行：正则会报出多少 → 真正需要处理多少。 */
export function formatText(report: ScanReport, options: TextReporterOptions = {}): string {
  const c = pc.createColors(options.color ?? false)
  const only = new Set(options.only ?? DEFAULT_ONLY)
  const threshold = options.dictSiblingThreshold ?? 3
  const { summary, results, errors } = report
  const { byCategory } = summary
  const lines: string[] = []

  // ---- 头部 + 摘要 ----
  lines.push(`${c.bold('i18n-triage')}  扫描 ${fmt(summary.files)} 个文件`, '')
  lines.push(c.bold('━━ 摘要 ━━'))
  lines.push(`  ${label('扫到含中文片段')}${num(summary.naive)} 处  ${c.dim('（正则口径）')}`)
  const pending = summary.fallback > 0 ? c.yellow(`（其中 ${fmt(summary.fallback)} 处待确认）`) : ''
  const tree = (category: Category): string =>
    label(CATEGORY_LABEL[category], TREE_PREFIX_WIDTH) + num(byCategory[category])
  lines.push(`  ├─ ${tree('A_UI_TEXT')} 处  ${c.yellow('← 需处理')}${pending}`)
  lines.push(`  ├─ ${tree('B_DEBUG_LOG')} 处  ${c.dim('（已归档）')}`)
  lines.push(`  ├─ ${tree('C_DICT')} 处  ${c.cyan('← 需独立方案')}`)
  lines.push(`  └─ ${tree('D_INTERNAL_KEY')} 处  ${c.dim('（已归档）')}`)
  lines.push(
    `  ${label('已接入 i18n 的调用')}${num(summary.i18nExcluded)} 处  ${c.dim('（t / $t，已排除）')}`,
  )
  lines.push(`  ${label('注释等已忽略')}${num(summary.ignored)} 处`)
  lines.push('')
  const pct = (summary.noiseRatio * 100).toFixed(1)
  lines.push(
    `  ${c.bold('降噪比')}    ${fmt(summary.naive)} → ${c.bold(c.green(fmt(byCategory.A_UI_TEXT)))}  （${pct}% 为噪音）`,
  )

  // ---- 分类明细 ----
  for (const category of CATEGORIES) {
    if (!only.has(category)) continue
    const items = results.filter((r) => r.category === category)
    lines.push('', c.bold(`━━ ${CATEGORY_LABEL[category]}（${fmt(items.length)}）━━`))
    if (category === 'C_DICT') {
      lines.push(`  ${c.dim('提示：字典类文案建议走配置化翻译表，不要逐句抽 key')}`)
      lines.push(...formatDictSection(items, threshold, c))
    } else {
      lines.push(...formatItemSection(items, c))
    }
  }

  // ---- 解析失败 ----
  if (errors.length > 0) {
    lines.push('', c.bold(c.red(`━━ 解析失败（${fmt(errors.length)}）━━`)))
    for (const e of errors) lines.push(`  ${e.file}  ${c.dim(e.message)}`)
  }

  return `${lines.join('\n')}\n`
}

/** A / B / D：按文件分组，逐条列出 行:列 "文案" kind 上下文 [待确认] */
function formatItemSection(items: readonly TriageResult[], c: Colors): string[] {
  if (items.length === 0) return [`  ${c.dim('（无）')}`]
  const lines: string[] = []
  let currentFile: string | undefined
  for (const r of items) {
    const { loc } = r.node
    if (loc.file !== currentFile) {
      currentFile = loc.file
      lines.push(`  ${c.underline(loc.file)}`)
    }
    const pos = `${loc.line}:${loc.column}`.padEnd(7)
    const quoted = `"${truncateDisplay(r.node.value, VALUE_MAX)}"`
    const value = c.green(quoted) + ' '.repeat(Math.max(0, VALUE_WIDTH - displayWidth(quoted)))
    const kind = c.dim(r.node.kind.padEnd(KIND_WIDTH))
    const context = r.node.attrName ?? r.node.calleeName ?? ''
    const tag = r.matchedBy === 'fallback' ? c.yellow('待确认') : ''
    const contextCell = tag ? padEndDisplay(context, CONTEXT_WIDTH) : context
    lines.push(`    ${pos}  ${value}  ${kind}${contextCell}${tag}`.trimEnd())
  }
  return lines
}

/** C：只按文件汇总数量，不逐条列出（字典要整体走配置化翻译表） */
function formatDictSection(items: readonly TriageResult[], threshold: number, c: Colors): string[] {
  if (items.length === 0) return [`  ${c.dim('（无）')}`]
  const perFile = new Map<string, number>()
  for (const r of items) perFile.set(r.node.loc.file, (perFile.get(r.node.loc.file) ?? 0) + 1)
  return [...perFile.entries()].map(
    ([file, count]) =>
      `  ${padEndDisplay(file, 40)}${fmt(count)} 处${c.dim(`（同一对象内 ≥${threshold} 个中文 value）`)}`,
  )
}
