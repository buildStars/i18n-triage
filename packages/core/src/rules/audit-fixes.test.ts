/**
 * Day 7 第二轮：对四个真实项目的 A / B / C / D 抽样人工复核后剩下的误判（见 docs/validation.md「抽样复核」）。
 */
import { describe, expect, it } from 'vitest'

import { makeCtx, makeNode } from '../test-utils/make-node'
import { aUiTextRule } from './a-ui-text'
import { createInternalKeyRule, dInternalKeyRule } from './d-internal-key'
import { triage } from './engine'

const ctx = makeCtx()

describe('dInternalKeyRule — data-* 里的展示属性不能被 D 抢走', () => {
  it('leaves data-placeholder / data-title / data-text to the A rule', () => {
    for (const attrName of ['data-placeholder', 'data-title', 'data-text', 'data-tooltip']) {
      expect(
        dInternalKeyRule(makeNode('template-attr', '按 Enter 发送', { attrName }), ctx),
        attrName,
      ).toBe(null)
    }
  })

  it('still claims ordinary data-* attributes', () => {
    expect(
      dInternalKeyRule(makeNode('template-attr', '埋点', { attrName: 'data-track' }), ctx),
    ).toBe('D_INTERNAL_KEY')
  })

  it('the exemption list is configurable', () => {
    const rule = createInternalKeyRule({ internalAttrs: ['data-*'], exceptAttrs: ['data-label'] })
    expect(rule(makeNode('template-attr', 'x', { attrName: 'data-label' }), ctx)).toBe(null)
    expect(rule(makeNode('template-attr', 'x', { attrName: 'data-placeholder' }), ctx)).toBe(
      'D_INTERNAL_KEY',
    )
  })

  it('end to end: data-placeholder is A, data-track is D', () => {
    const results = triage(
      [
        makeNode('template-attr', '按 Enter 发送', { attrName: 'data-placeholder' }),
        makeNode('template-attr', '埋点', { attrName: 'data-track' }),
      ],
      ctx,
    )
    expect(results.map((r) => r.category)).toEqual(['A_UI_TEXT', 'D_INTERNAL_KEY'])
  })
})

describe('aUiTextRule — 第二轮补充的展示 prop 与 API', () => {
  it('treats help / unit / addon-after / addon-before / checked-children as display props', () => {
    for (const attrName of [
      'help',
      'unit',
      'addon-after',
      'addonBefore',
      'checked-children',
      'unCheckedChildren',
    ]) {
      expect(
        aUiTextRule(makeNode('object-value', '中文', { attrName, siblingChineseCount: 1 }), ctx),
        attrName,
      ).toBe('A_UI_TEXT')
    }
  })

  it('treats zod validation messages as UI text', () => {
    for (const calleeName of ['z.string().min', 'z.string', 'z.email', 'z.array().min']) {
      expect(
        aUiTextRule(makeNode('call-arg', '请输入用户名', { calleeName }), ctx),
        calleeName,
      ).toBe('A_UI_TEXT')
    }
  })
})
