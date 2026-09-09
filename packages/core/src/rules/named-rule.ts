import type { Rule } from '../types'

/** 带名字的规则：`ruleName` 会写进 TriageResult.matchedBy，用于报告与调试 */
export type NamedRule = Rule & { readonly ruleName: string }

export function defineRule(ruleName: string, rule: Rule): NamedRule {
  return Object.assign(rule, { ruleName })
}
