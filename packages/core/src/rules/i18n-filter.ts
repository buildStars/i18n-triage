import type { StringNode } from '../types'
import { matchesCallee } from './callee-match'
import { DEFAULT_I18N_CALLEES } from './defaults'

/**
 * 节点是否是 i18n 调用的实参（`t('key')`、`$t('key', { name: '中文' })`）。
 * 这些字符串已经接入翻译，不进入四类分类；在 triage 之前用 excludeI18nCalls 剔除。
 */
export function isI18nCall(
  node: StringNode,
  patterns: readonly string[] = DEFAULT_I18N_CALLEES,
): boolean {
  return node.calleeName !== undefined && matchesCallee(node.calleeName, patterns)
}

/** 剔除 i18n 调用实参，返回新数组，顺序不变 */
export function excludeI18nCalls(
  nodes: readonly StringNode[],
  patterns: readonly string[] = DEFAULT_I18N_CALLEES,
): StringNode[] {
  return nodes.filter((node) => !isI18nCall(node, patterns))
}
