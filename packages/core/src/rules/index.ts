// 规则层：StringNode + FileContext → Category | null
// 四条规则（A / B / C / D）按优先级 [B, D, C, A] 串行执行，第一个命中者胜出；engine.ts 负责串行与 fallback。
// 白名单与阈值全部在 defaults.ts，规则函数通过 create*Rule(options) 工厂接收覆盖。

export type { NamedRule } from './named-rule'
export { defineRule } from './named-rule'

export {
  DEFAULT_DEBUG_APIS,
  DEFAULT_DICT_DIRS,
  DEFAULT_DICT_SIBLING_THRESHOLD,
  DEFAULT_DISPLAY_ATTRS,
  DEFAULT_I18N_CALLEES,
  DEFAULT_UI_APIS,
} from './defaults'
export { matchesCallee, toKebabCase } from './callee-match'

export type { UiTextOptions } from './a-ui-text'
export { aUiTextRule, createUiTextRule } from './a-ui-text'
export type { DebugLogOptions } from './b-debug-log'
export { bDebugLogRule, createDebugLogRule } from './b-debug-log'
export type { DictOptions } from './c-dict'
export { cDictRule, createDictRule, isInDictPath } from './c-dict'
export { dInternalKeyRule } from './d-internal-key'

export type { RulesConfig } from './engine'
export {
  FALLBACK_CATEGORY,
  FALLBACK_MATCHED_BY,
  createDefaultRules,
  defaultRules,
  triage,
} from './engine'
export { excludeI18nCalls, isI18nCall } from './i18n-filter'
