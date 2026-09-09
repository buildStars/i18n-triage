import { describe, expect, it } from 'vitest'

import { makeCtx, makeNode } from '../test-utils/make-node'
import { bDebugLogRule, createDebugLogRule } from './b-debug-log'

const ctx = makeCtx()

describe('bDebugLogRule', () => {
  it('has a stable ruleName for reports', () => {
    expect(bDebugLogRule.ruleName).toBe('b-debug-log')
  })

  it('classifies arguments of console.* / logger.* / devLogger.* / debug.* / log as B', () => {
    for (const calleeName of [
      'console.log',
      'console.error',
      'window.console.warn',
      'logger.warn',
      'devLogger.info',
      'debug.trace',
      'log',
    ]) {
      expect(bDebugLogRule(makeNode('call-arg', '加载失败', { calleeName }), ctx), calleeName).toBe(
        'B_DEBUG_LOG',
      )
    }
  })

  it('classifies object values passed to debug APIs as B', () => {
    expect(
      bDebugLogRule(
        makeNode('object-value', '加载失败', { calleeName: 'console.log', siblingChineseCount: 1 }),
        ctx,
      ),
    ).toBe('B_DEBUG_LOG')
  })

  it('does not match UI APIs, i18n calls or unnamed callees', () => {
    for (const calleeName of ['showToast', 'ElMessage.error', 't', 'logging', 'console']) {
      expect(bDebugLogRule(makeNode('call-arg', '中文', { calleeName }), ctx), calleeName).toBe(
        null,
      )
    }
    expect(bDebugLogRule(makeNode('call-arg', '中文'), ctx)).toBe(null)
  })

  it('does not match nodes without a callee context', () => {
    expect(bDebugLogRule(makeNode('template-text', '中文'), ctx)).toBe(null)
    expect(bDebugLogRule(makeNode('literal', '中文'), ctx)).toBe(null)
    expect(bDebugLogRule(makeNode('object-key', '中文'), ctx)).toBe(null)
  })
})

describe('createDebugLogRule (configurable)', () => {
  it('replaces the debug API list', () => {
    const rule = createDebugLogRule({ debugApis: ['Sentry.*'] })
    expect(rule(makeNode('call-arg', '中文', { calleeName: 'Sentry.captureMessage' }), ctx)).toBe(
      'B_DEBUG_LOG',
    )
    expect(rule(makeNode('call-arg', '中文', { calleeName: 'console.log' }), ctx)).toBe(null)
  })
})
