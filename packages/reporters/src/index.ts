// 报告层：TriageResult[] → 字符串（text / json；sarif / html 后续）。
// 纯格式化函数，不做 IO；写文件由 cli 负责。

export type { CategoryLetter } from './categories'
export {
  CATEGORIES,
  CATEGORY_BY_LETTER,
  CATEGORY_LABEL,
  CATEGORY_LETTER,
  DEFAULT_ONLY,
} from './categories'
export { charWidth, displayWidth, padEndDisplay, truncateDisplay } from './display-width'
export type { CategoryCounts, FileScan, ReportError, ScanReport, ScanSummary } from './report-model'
export { buildScanReport } from './report-model'
export type { TextReporterOptions } from './text'
export { formatText } from './text'
export type { JsonReport, JsonReporterOptions, JsonResult } from './json'
export { JSON_SCHEMA_VERSION, formatJson, toJsonReport } from './json'
