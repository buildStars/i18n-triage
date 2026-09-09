import type { NamedRule } from './named-rule'
import { defineRule } from './named-rule'

/**
 * D 内部键：对象字面量的 key、enum 成员、被用作 map 索引的字符串。
 * 解析器已把这三种都归到 object-key / enum-member，这里只看 kind。
 */
export const dInternalKeyRule: NamedRule = defineRule('d-internal-key', (node) =>
  node.kind === 'object-key' || node.kind === 'enum-member' ? 'D_INTERNAL_KEY' : null,
)
