// 语言包层：完整度对比 + 代码引用采集 + 死 key / 未定义 key 审计。纯函数；读文件由 cli 负责。

export { flattenMessages } from './flatten'
export type { LocaleDiff } from './compare'
export { compareLocales } from './compare'
export type { DynamicUsage, FindKeyUsagesOptions, KeyUsage, KeyUsages } from './usages'
export { DEFAULT_KEY_ATTRS, findKeyUsages } from './usages'
export type { LocaleAudit, LocaleAuditInput } from './audit'
export { auditLocales } from './audit'
