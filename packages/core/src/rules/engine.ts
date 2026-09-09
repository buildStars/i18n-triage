import type { Category, FileContext, Rule, StringNode, TriageResult } from '../types'
import { createUiTextRule } from './a-ui-text'
import { createDebugLogRule } from './b-debug-log'
import { createDictRule } from './c-dict'
import { dInternalKeyRule } from './d-internal-key'
import type { NamedRule } from './named-rule'

/** 四条默认规则的可配置项，全部可选，省略即用 defaults.ts */
export interface RulesConfig {
  displayAttrs?: readonly string[]
  uiApis?: readonly string[]
  debugApis?: readonly string[]
  dictDirs?: readonly string[]
  dictSiblingThreshold?: number
}

/**
 * 默认优先级 [B, D, C, A]：先排除明确不用翻译的（调试日志、内部键），再判字典，最后 A 兜底。
 * `console.error('加载失败')` 同时满足 B 与 A，必须 B 先命中。
 */
export function createDefaultRules(config: RulesConfig = {}): NamedRule[] {
  return [
    createDebugLogRule({ debugApis: config.debugApis }),
    dInternalKeyRule,
    createDictRule({ dictDirs: config.dictDirs, siblingThreshold: config.dictSiblingThreshold }),
    createUiTextRule({ displayAttrs: config.displayAttrs, uiApis: config.uiApis }),
  ]
}

export const defaultRules: readonly NamedRule[] = createDefaultRules()

/** 没有任何规则命中时的保守归类：宁可让用户多看一眼，也不漏掉真正的 UI 文案 */
export const FALLBACK_CATEGORY: Category = 'A_UI_TEXT'
export const FALLBACK_MATCHED_BY = 'fallback'

/**
 * 规则按数组顺序串行，第一个命中者胜出；全部未命中归为 A_UI_TEXT / 'fallback'。
 * 输出顺序与输入一致，`node` 保持同一引用。
 */
export function triage(
  nodes: readonly StringNode[],
  ctx: FileContext,
  rules: readonly Rule[] = defaultRules,
): TriageResult[] {
  return nodes.map((node) => {
    for (const rule of rules) {
      const category = rule(node, ctx)
      if (category !== null) return { node, category, matchedBy: ruleNameOf(rule) }
    }
    return { node, category: FALLBACK_CATEGORY, matchedBy: FALLBACK_MATCHED_BY }
  })
}

function ruleNameOf(rule: Rule): string {
  const explicit: unknown = (rule as { ruleName?: unknown }).ruleName
  if (typeof explicit === 'string' && explicit.length > 0) return explicit
  return rule.name.length > 0 ? rule.name : 'anonymous'
}
