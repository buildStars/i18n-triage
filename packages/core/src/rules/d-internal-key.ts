import { matchesAttrName } from './callee-match'
import { DEFAULT_DISPLAY_ATTRS, DEFAULT_INTERNAL_ATTRS } from './defaults'
import type { NamedRule } from './named-rule'
import { defineRule } from './named-rule'

export interface InternalKeyOptions {
  /** 值永远不是文案的模板属性名模式（`id`、`fill`、`data-*` …） */
  internalAttrs: readonly string[]
  /**
   * 即使命中 internalAttrs 也不判 D 的属性名模式，默认是展示属性列表：
   * `data-placeholder="按 Enter 发送"` 虽然是 data-*，但它是展示文案，要留给 A 规则。
   */
  exceptAttrs: readonly string[]
}

/**
 * D 内部键：
 * 1. 对象字面量的 key、enum 成员、被用作 map 索引的字符串（解析器已归到 object-key / enum-member）
 * 2. 模板里标识 / 几何 / 埋点类属性的值（`id="矩形"`、`fill="url(#渐变)"`、`data-track="埋点名"`），
 *    但排除同时匹配展示属性模式的名字
 */
export function createInternalKeyRule(options: Partial<InternalKeyOptions> = {}): NamedRule {
  const attrs = options.internalAttrs ?? DEFAULT_INTERNAL_ATTRS
  const except = options.exceptAttrs ?? DEFAULT_DISPLAY_ATTRS
  return defineRule('d-internal-key', (node) => {
    if (node.kind === 'object-key' || node.kind === 'enum-member') return 'D_INTERNAL_KEY'
    if (
      node.kind === 'template-attr' &&
      node.attrName !== undefined &&
      matchesAttrName(node.attrName, attrs) &&
      !matchesAttrName(node.attrName, except)
    ) {
      return 'D_INTERNAL_KEY'
    }
    return null
  })
}

export const dInternalKeyRule: NamedRule = createInternalKeyRule()
