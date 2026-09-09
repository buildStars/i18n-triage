import type { Category, TriageResult } from '@i18n-triage/core'

import { CATEGORIES } from './categories'

/** 一个文件的扫描结果，由 cli 组装 */
export interface FileScan {
  /** 相对项目根的 posix 路径 */
  file: string
  /** 剔除 i18n 调用之后、经过分类的全部节点 */
  results: TriageResult[]
  /** 正则口径的中文片段数（countChineseRuns），作为降噪比的分母 */
  naiveCount: number
  /** 因为是 t() / $t() 实参而被剔除的节点数 */
  i18nExcluded: number
}

export interface ReportError {
  file: string
  message: string
}

export type CategoryCounts = Record<Category, number>

export interface ScanSummary {
  files: number
  /** 扫到含中文片段（正则口径） */
  naive: number
  /** 进入四类分类的节点总数 = A + B + C + D */
  classified: number
  byCategory: CategoryCounts
  /** A 类里 matchedBy === 'fallback' 的数量（待确认） */
  fallback: number
  i18nExcluded: number
  /** 注释、import 路径、正则等被 AST 天然跳过的片段：naive − classified − i18nExcluded，不小于 0 */
  ignored: number
  /** 噪音占比 = (naive − A) / naive，naive 为 0 时为 0 */
  noiseRatio: number
}

export interface ScanReport {
  summary: ScanSummary
  /** 全部结果，按文件路径、offset 排序 */
  results: TriageResult[]
  errors: ReportError[]
}

function emptyCounts(): CategoryCounts {
  const counts = {} as CategoryCounts
  for (const c of CATEGORIES) counts[c] = 0
  return counts
}

export function buildScanReport(
  files: readonly FileScan[],
  errors: readonly ReportError[] = [],
): ScanReport {
  const byCategory = emptyCounts()
  let naive = 0
  let fallback = 0
  let i18nExcluded = 0
  const results: TriageResult[] = []

  for (const file of files) {
    naive += file.naiveCount
    i18nExcluded += file.i18nExcluded
    for (const r of file.results) {
      byCategory[r.category] += 1
      if (r.category === 'A_UI_TEXT' && r.matchedBy === 'fallback') fallback += 1
      results.push(r)
    }
  }

  results.sort((a, b) => {
    if (a.node.loc.file !== b.node.loc.file) return a.node.loc.file < b.node.loc.file ? -1 : 1
    return a.node.loc.offset - b.node.loc.offset
  })

  const classified = CATEGORIES.reduce((sum, c) => sum + byCategory[c], 0)
  const ignored = Math.max(0, naive - classified - i18nExcluded)
  const noiseRatio =
    naive > 0 ? Math.min(1, Math.max(0, (naive - byCategory.A_UI_TEXT) / naive)) : 0

  return {
    summary: {
      files: files.length,
      naive,
      classified,
      byCategory,
      fallback,
      i18nExcluded,
      ignored,
      noiseRatio,
    },
    results,
    errors: [...errors],
  }
}
