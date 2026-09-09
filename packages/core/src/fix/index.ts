// --fix 规划层：TriageResult[] → 文本编辑 + 新增 key。纯函数，不读写文件；落盘由 cli 负责。

export type { TextEdit } from './edits'
export { applyEdits } from './edits'
export type { KeyStyle } from './keys'
export { hashKey, makeKey, needsHashFallback, quoteJs } from './keys'
export type { FixOptions, FixPlan, FixSkip, FixSkipReason } from './plan'
export { planFixes } from './plan'
