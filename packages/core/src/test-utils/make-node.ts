import type { FileContext, StringKind, StringNode } from '../types'

/** 测试用：按最少字段构造 StringNode，位置字段给固定值 */
export function makeNode(
  kind: StringKind,
  value: string,
  extra: Partial<Omit<StringNode, 'kind' | 'value'>> = {},
): StringNode {
  return {
    kind,
    value,
    loc: { file: 'src/demo.ts', line: 1, column: 1, offset: 0 },
    ...extra,
  }
}

export function makeCtx(relativePath = 'src/views/Order.vue'): FileContext {
  return { relativePath }
}
