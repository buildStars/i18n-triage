import { describe, expect, it } from 'vitest'

import type { FileContext, StringNode } from '../types'
import { parseScript } from './script'

const ctx: FileContext = { relativePath: 'src/constants/order.ts' }

const pick = (nodes: StringNode[]) => nodes.map((n) => ({ value: n.value, kind: n.kind }))

describe('parseScript — 中文标识符作为 key（不是字符串字面量）', () => {
  it('reports unquoted Chinese property names as object-key', () => {
    expect(pick(parseScript(`const m = { 待支付: 0, 已支付: 1, paid: 2 }`, ctx))).toEqual([
      { value: '待支付', kind: 'object-key' },
      { value: '已支付', kind: 'object-key' },
    ])
  })

  it('reports Chinese enum member identifiers as enum-member', () => {
    expect(pick(parseScript(`enum E { 支付宝 = 1, Wechat = 2 }`, ctx))).toEqual([
      { value: '支付宝', kind: 'enum-member' },
    ])
  })

  it('reports Chinese property access names as object-key (map lookup)', () => {
    expect(pick(parseScript(`const v = dict.待支付`, ctx))).toEqual([
      { value: '待支付', kind: 'object-key' },
    ])
  })

  it('does not report Chinese identifiers used as variables or parameters', () => {
    const src = `const 金额 = 1
function f(数量: number) { return 数量 + 金额 }`
    expect(parseScript(src, ctx)).toEqual([])
  })

  it('positions the identifier key at its start', () => {
    const src = `const m = {\n  待支付: 0,\n}`
    const [n] = parseScript(src, ctx)
    expect(n?.loc).toMatchObject({ line: 2, column: 3, offset: src.indexOf('待支付') })
  })
})
