import { matchesCallee, toKebabCase } from './callee-match'
import { DEFAULT_DISPLAY_ATTRS, DEFAULT_UI_APIS } from './defaults'
import type { NamedRule } from './named-rule'
import { defineRule } from './named-rule'

export interface UiTextOptions {
  /** 展示类属性白名单（kebab-case 或 camelCase 均可） */
  displayAttrs: readonly string[]
  /** UI 提示 API 模式列表，语法见 callee-match.ts */
  uiApis: readonly string[]
}

/**
 * A 必翻译 UI 文案。命中任一即为 A：
 * 1. template 文本节点
 * 2. 白名单展示属性
 * 3. UI 提示 API 的实参——包括对象式调用 `showToast({ message: 'x' })` 里的 object-value（带 calleeName）
 */
export function createUiTextRule(options: Partial<UiTextOptions> = {}): NamedRule {
  const attrs = new Set((options.displayAttrs ?? DEFAULT_DISPLAY_ATTRS).map(toKebabCase))
  const apis = options.uiApis ?? DEFAULT_UI_APIS

  return defineRule('a-ui-text', (node) => {
    if (node.kind === 'template-text') return 'A_UI_TEXT'
    if (node.kind === 'template-attr') {
      return node.attrName !== undefined && attrs.has(toKebabCase(node.attrName))
        ? 'A_UI_TEXT'
        : null
    }
    if (node.calleeName !== undefined && matchesCallee(node.calleeName, apis)) return 'A_UI_TEXT'
    return null
  })
}

export const aUiTextRule: NamedRule = createUiTextRule()
