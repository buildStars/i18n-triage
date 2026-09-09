import { describe, expect, it } from 'vitest'

import { makeNode } from '../test-utils/make-node'
import { excludeI18nCalls, isI18nCall } from './i18n-filter'

describe('isI18nCall', () => {
  it('recognises the common vue-i18n call shapes', () => {
    for (const calleeName of [
      't',
      '$t',
      'tc',
      '$tc',
      'te',
      '$te',
      'this.$t',
      'proxy.$t',
      'i18n.t',
      'i18n.global.t',
      'useI18n().t',
    ]) {
      expect(isI18nCall(makeNode('call-arg', 'x', { calleeName })), calleeName).toBe(true)
    }
  })

  it('does not treat other calls or unnamed callees as i18n', () => {
    for (const calleeName of [
      'showToast',
      'toast',
      'tt',
      'format',
      'translateLater',
      'console.log',
    ]) {
      expect(isI18nCall(makeNode('call-arg', 'x', { calleeName })), calleeName).toBe(false)
    }
    expect(isI18nCall(makeNode('call-arg', 'x'))).toBe(false)
    expect(isI18nCall(makeNode('template-text', 'x'))).toBe(false)
  })

  it('also covers object values passed to an i18n call (interpolation params)', () => {
    expect(
      isI18nCall(makeNode('object-value', '中文', { calleeName: 't', siblingChineseCount: 1 })),
    ).toBe(true)
  })

  it('accepts a custom pattern list', () => {
    expect(isI18nCall(makeNode('call-arg', 'x', { calleeName: 'translate' }), ['translate'])).toBe(
      true,
    )
    expect(isI18nCall(makeNode('call-arg', 'x', { calleeName: 't' }), ['translate'])).toBe(false)
  })
})

describe('excludeI18nCalls', () => {
  it('drops i18n call arguments and keeps everything else in order', () => {
    const keep1 = makeNode('template-text', '暂无数据')
    const drop = makeNode('call-arg', '已封盘', { calleeName: 't' })
    const keep2 = makeNode('call-arg', '已封盘', { calleeName: 'showToast' })
    expect(excludeI18nCalls([keep1, drop, keep2])).toEqual([keep1, keep2])
  })

  it('returns a new array and leaves the input untouched', () => {
    const nodes = [makeNode('call-arg', 'x', { calleeName: 't' })]
    const out = excludeI18nCalls(nodes)
    expect(out).toEqual([])
    expect(nodes).toHaveLength(1)
  })
})
