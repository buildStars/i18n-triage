import { describe, expect, it } from 'vitest'

import { makeCtx, makeNode } from '../test-utils/make-node'
import { dInternalKeyRule } from './d-internal-key'

const ctx = makeCtx()

describe('dInternalKeyRule', () => {
  it('has a stable ruleName for reports', () => {
    expect(dInternalKeyRule.ruleName).toBe('d-internal-key')
  })

  it('classifies object keys (including map indexes) as D', () => {
    expect(dInternalKeyRule(makeNode('object-key', '联盟'), ctx)).toBe('D_INTERNAL_KEY')
  })

  it('classifies enum members as D', () => {
    expect(dInternalKeyRule(makeNode('enum-member', '红波'), ctx)).toBe('D_INTERNAL_KEY')
  })

  it('does not match values, arguments, template nodes or literals', () => {
    expect(
      dInternalKeyRule(makeNode('object-value', '联盟', { siblingChineseCount: 1 }), ctx),
    ).toBe(null)
    expect(dInternalKeyRule(makeNode('call-arg', '联盟', { calleeName: 'showToast' }), ctx)).toBe(
      null,
    )
    expect(dInternalKeyRule(makeNode('template-text', '联盟'), ctx)).toBe(null)
    expect(dInternalKeyRule(makeNode('template-attr', '联盟', { attrName: 'title' }), ctx)).toBe(
      null,
    )
    expect(dInternalKeyRule(makeNode('literal', '联盟'), ctx)).toBe(null)
  })
})
