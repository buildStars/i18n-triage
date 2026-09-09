import type { Category, StringKind, TriageResult } from '@i18n-triage/core'

import type { ReportError, ScanReport, ScanSummary, SkippedFile } from './report-model'

export interface JsonReporterOptions {
  /** 只输出这些类别的结果；摘要始终是完整的。默认全部 */
  only?: readonly Category[]
  /** 默认 true（两空格缩进）；false 输出单行 */
  pretty?: boolean
}

/** 扁平化的单条结果，方便 jq / 表格工具消费 */
export interface JsonResult {
  file: string
  line: number
  column: number
  offset: number
  value: string
  kind: StringKind
  attrName?: string
  calleeName?: string
  siblingChineseCount?: number
  category: Category
  matchedBy: string
}

export interface JsonReport {
  schemaVersion: 1
  summary: ScanSummary
  results: JsonResult[]
  errors: ReportError[]
  skipped: SkippedFile[]
}

export const JSON_SCHEMA_VERSION = 1 as const

function flatten(r: TriageResult): JsonResult {
  const { node } = r
  const out: JsonResult = {
    file: node.loc.file,
    line: node.loc.line,
    column: node.loc.column,
    offset: node.loc.offset,
    value: node.value,
    kind: node.kind,
    category: r.category,
    matchedBy: r.matchedBy,
  }
  if (node.attrName !== undefined) out.attrName = node.attrName
  if (node.calleeName !== undefined) out.calleeName = node.calleeName
  if (node.siblingChineseCount !== undefined) out.siblingChineseCount = node.siblingChineseCount
  return out
}

export function toJsonReport(report: ScanReport, options: JsonReporterOptions = {}): JsonReport {
  const only = options.only ? new Set(options.only) : undefined
  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    summary: report.summary,
    results: report.results.filter((r) => only === undefined || only.has(r.category)).map(flatten),
    errors: report.errors,
    skipped: report.skipped,
  }
}

export function formatJson(report: ScanReport, options: JsonReporterOptions = {}): string {
  const payload = toJsonReport(report, options)
  return options.pretty === false ? JSON.stringify(payload) : JSON.stringify(payload, null, 2)
}
