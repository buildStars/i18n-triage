import { describe, expect, it } from 'vitest'

import { makeCtx, makeNode } from '../test-utils/make-node'
import type { Rule } from '../types'
import { createDefaultRules, defaultRules, triage } from './engine'

describe('triage — 默认优先级 [B, D, C, A]', () => {
  it('exposes the default rule order by name', () => {
    expect(defaultRules.map((r) => r.ruleName)).toEqual([
      'b-debug-log',
      'd-internal-key',
      'c-dict',
      'a-ui-text',
    ])
  })

  it("console.error('加载失败') is B, not A, although both rules see a call-arg", () => {
    const node = makeNode('call-arg', '加载失败', { calleeName: 'console.error' })
    expect(triage([node], makeCtx('src/views/Order.vue'))).toEqual([
      { node, category: 'B_DEBUG_LOG', matchedBy: 'b-debug-log' },
    ])
  })

  it("constants/lottery.ts { label: '红波' } with 5 Chinese siblings is C, not A", () => {
    const node = makeNode('object-value', '红波', { siblingChineseCount: 5 })
    expect(triage([node], makeCtx('src/constants/lottery.ts'))).toEqual([
      { node, category: 'C_DICT', matchedBy: 'c-dict' },
    ])
  })

  it("constants/lottery.ts { '红波': 1 } is D, not C — keys win over dictionaries", () => {
    const node = makeNode('object-key', '红波')
    expect(triage([node], makeCtx('src/constants/lottery.ts'))).toEqual([
      { node, category: 'D_INTERNAL_KEY', matchedBy: 'd-internal-key' },
    ])
  })

  it('showToast({ message }) inside constants/ with few siblings is A via the UI API', () => {
    const node = makeNode('object-value', '已封盘', {
      calleeName: 'showToast',
      siblingChineseCount: 1,
    })
    expect(triage([node], makeCtx('src/constants/lottery.ts'))[0]).toMatchObject({
      category: 'A_UI_TEXT',
      matchedBy: 'a-ui-text',
    })
  })

  it('template text and whitelisted attributes are A by rule', () => {
    const ctx = makeCtx()
    const text = makeNode('template-text', '暂无数据')
    const attr = makeNode('template-attr', '请输入', { attrName: 'placeholder' })
    expect(triage([text, attr], ctx)).toEqual([
      { node: text, category: 'A_UI_TEXT', matchedBy: 'a-ui-text' },
      { node: attr, category: 'A_UI_TEXT', matchedBy: 'a-ui-text' },
    ])
  })
})

describe('triage — fallback', () => {
  it('classifies nodes no rule claims as A with matchedBy "fallback"', () => {
    const ctx = makeCtx()
    const literal = makeNode('literal', '裸字面量')
    const attr = makeNode('template-attr', '中文', { attrName: 'format' })
    const arg = makeNode('call-arg', '中文', { calleeName: 'router.push' })
    const value = makeNode('object-value', '中文', { siblingChineseCount: 1 })
    expect(triage([literal, attr, arg, value], ctx).map((r) => [r.category, r.matchedBy])).toEqual([
      ['A_UI_TEXT', 'fallback'],
      ['A_UI_TEXT', 'fallback'],
      ['A_UI_TEXT', 'fallback'],
      ['A_UI_TEXT', 'fallback'],
    ])
  })

  it('returns an empty array for no nodes', () => {
    expect(triage([], makeCtx())).toEqual([])
  })

  it('preserves input order and node identity', () => {
    const nodes = [
      makeNode('object-key', 'k'),
      makeNode('template-text', 't'),
      makeNode('call-arg', 'c', { calleeName: 'console.log' }),
    ]
    const results = triage(nodes, makeCtx())
    expect(results.map((r) => r.node)).toEqual(nodes)
    expect(results.map((r) => r.category)).toEqual(['D_INTERNAL_KEY', 'A_UI_TEXT', 'B_DEBUG_LOG'])
  })
})

describe('triage — 自定义规则', () => {
  it('runs caller-provided rules in order, first match wins', () => {
    const alwaysD: Rule = () => 'D_INTERNAL_KEY'
    const alwaysB: Rule = () => 'B_DEBUG_LOG'
    const node = makeNode('template-text', '中文')
    expect(triage([node], makeCtx(), [alwaysD, alwaysB])[0]).toMatchObject({
      category: 'D_INTERNAL_KEY',
    })
    expect(triage([node], makeCtx(), [alwaysB, alwaysD])[0]).toMatchObject({
      category: 'B_DEBUG_LOG',
    })
  })

  it('uses ruleName when present, otherwise the function name, otherwise "anonymous"', () => {
    const named = Object.assign((() => 'C_DICT') as Rule, { ruleName: 'my-dict' })
    function namedFn(): 'B_DEBUG_LOG' {
      return 'B_DEBUG_LOG'
    }
    const anon: Rule = () => 'D_INTERNAL_KEY'
    const node = makeNode('literal', '中文')
    expect(triage([node], makeCtx(), [named])[0]?.matchedBy).toBe('my-dict')
    expect(triage([node], makeCtx(), [namedFn])[0]?.matchedBy).toBe('namedFn')
    expect(triage([node], makeCtx(), [anon])[0]?.matchedBy).toBe('anon')
    expect(triage([node], makeCtx(), [() => 'D_INTERNAL_KEY'])[0]?.matchedBy).toBe('anonymous')
  })

  it('an empty rule list makes everything fallback A', () => {
    const node = makeNode('object-key', '中文')
    expect(triage([node], makeCtx(), [])).toEqual([
      { node, category: 'A_UI_TEXT', matchedBy: 'fallback' },
    ])
  })
})

describe('createDefaultRules', () => {
  it('builds the [B, D, C, A] chain with custom options applied', () => {
    const rules = createDefaultRules({
      uiApis: ['myToast'],
      debugApis: ['trace.*'],
      dictDirs: ['dictionaries'],
      dictSiblingThreshold: 2,
      displayAttrs: ['tip'],
    })
    expect(rules.map((r) => r.ruleName)).toEqual([
      'b-debug-log',
      'd-internal-key',
      'c-dict',
      'a-ui-text',
    ])
    const ctx = makeCtx('src/dictionaries/x.ts')
    expect(
      triage([makeNode('call-arg', 'x', { calleeName: 'trace.info' })], ctx, rules)[0]?.category,
    ).toBe('B_DEBUG_LOG')
    expect(
      triage([makeNode('call-arg', 'x', { calleeName: 'console.log' })], ctx, rules)[0]?.matchedBy,
    ).toBe('fallback')
    expect(
      triage([makeNode('object-value', 'x', { siblingChineseCount: 2 })], ctx, rules)[0]?.category,
    ).toBe('C_DICT')
    expect(
      triage([makeNode('call-arg', 'x', { calleeName: 'myToast' })], ctx, rules)[0]?.category,
    ).toBe('A_UI_TEXT')
    expect(
      triage([makeNode('template-attr', 'x', { attrName: 'tip' })], ctx, rules)[0]?.matchedBy,
    ).toBe('a-ui-text')
  })

  it('returns the default chain when called without options', () => {
    const node = makeNode('call-arg', 'x', { calleeName: 'console.log' })
    expect(triage([node], makeCtx(), createDefaultRules())[0]?.category).toBe('B_DEBUG_LOG')
  })
})
