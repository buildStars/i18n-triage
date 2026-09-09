import { describe, expect, it } from 'vitest'

import type { SourceLocation } from '../types'
import { auditLocales } from './audit'

const loc = (line: number): SourceLocation => ({ file: 'src/a.vue', line, column: 1, offset: line })

const source = new Map([
  ['common.ok', '确定'],
  ['common.cancel', '取消'],
  ['common.unused', '从未使用'],
  ['order.status.paid', '已支付'],
  ['order.status.pending', '待支付'],
  ['typo', '拼写'],
])

describe('auditLocales', () => {
  const audit = auditLocales({
    sourceLocale: 'zh-CN',
    source,
    targets: new Map([
      [
        'en-US',
        new Map([
          ['common.ok', 'OK'],
          ['common.cancel', ''],
          ['order.status.paid', 'Paid'],
          ['order.status.pending', 'Pending'],
          ['onlyInEn', 'x'],
        ]),
      ],
    ]),
    usages: {
      static: [
        { key: 'common.ok', loc: loc(1), calleeName: 't' },
        { key: 'order.status.paid', loc: loc(2), calleeName: 't' },
        { key: 'typoo', loc: loc(3), calleeName: '$t' },
        { key: 'common.ok', loc: loc(4), calleeName: '$t' },
      ],
      dynamic: [
        { prefix: 'order.status.', loc: loc(5), calleeName: 't' },
        { prefix: undefined, loc: loc(6), calleeName: 't' },
      ],
      literals: ['common.cancel', '/login', 'typoo'],
    },
  })

  it('summarises the source and per-locale completeness', () => {
    expect(audit.sourceLocale).toBe('zh-CN')
    expect(audit.sourceKeys).toBe(6)
    expect(audit.diffs).toHaveLength(1)
    expect(audit.diffs[0]).toMatchObject({
      locale: 'en-US',
      missing: ['common.unused', 'typo'],
      extra: ['onlyInEn'],
      empty: ['common.cancel'],
    })
  })

  it('separates dead keys from keys a dynamic prefix or a plain string literal may reference', () => {
    expect(audit.dead).toEqual(['common.unused', 'typo'])
    expect(audit.maybeUsed).toEqual([{ key: 'order.status.pending', prefix: 'order.status.' }])
    // 'common.cancel' 出现在某个字符串字面量里（如路由 meta.title），不算死
    expect(audit.referencedAsLiteral).toEqual(['common.cancel'])
  })

  it('reports usages of keys the source locale does not define, with every location', () => {
    expect(audit.undefined).toEqual([{ key: 'typoo', loc: loc(3), calleeName: '$t' }])
  })

  it('counts distinct used keys and dynamic calls', () => {
    expect(audit.usedKeys).toBe(2) // common.ok, order.status.paid（typoo 未定义不算）
    expect(audit.dynamic).toHaveLength(2)
    expect(audit.dynamicWithoutPrefix).toBe(1)
  })

  it('treats every key as possibly used when a dynamic call has no prefix? no — only prefixed ones count', () => {
    const noPrefixOnly = auditLocales({
      sourceLocale: 'zh-CN',
      source,
      targets: new Map(),
      usages: { static: [], dynamic: [{ prefix: undefined, loc: loc(1) }], literals: [] },
    })
    expect(noPrefixOnly.dead).toHaveLength(6)
    expect(noPrefixOnly.dynamicWithoutPrefix).toBe(1)
  })
})
