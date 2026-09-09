import { describe, expect, it } from 'vitest'

import { makeCtx, makeNode } from '../test-utils/make-node'
import { aUiTextRule, createUiTextRule } from './a-ui-text'

const ctx = makeCtx()

describe('aUiTextRule', () => {
  it('has a stable ruleName for reports', () => {
    expect(aUiTextRule.ruleName).toBe('a-ui-text')
  })

  it('classifies template text nodes as A', () => {
    expect(aUiTextRule(makeNode('template-text', '暂无数据'), ctx)).toBe('A_UI_TEXT')
  })

  it('classifies whitelisted display attributes as A (kebab-case and camelCase)', () => {
    expect(aUiTextRule(makeNode('template-attr', '请输入', { attrName: 'placeholder' }), ctx)).toBe(
      'A_UI_TEXT',
    )
    expect(
      aUiTextRule(makeNode('template-attr', '确定', { attrName: 'confirm-button-text' }), ctx),
    ).toBe('A_UI_TEXT')
    expect(
      aUiTextRule(makeNode('template-attr', '确定', { attrName: 'confirmButtonText' }), ctx),
    ).toBe('A_UI_TEXT')
  })

  it('does not match attributes outside the whitelist', () => {
    expect(aUiTextRule(makeNode('template-attr', '中文', { attrName: 'data-track' }), ctx)).toBe(
      null,
    )
    expect(aUiTextRule(makeNode('template-attr', '中文', { attrName: 'name' }), ctx)).toBe(null)
  })

  it('classifies arguments of UI prompt APIs as A', () => {
    for (const calleeName of [
      'showToast',
      'showDialog',
      'showConfirmDialog',
      'Notify',
      'ElMessage',
      'ElMessage.error',
      'ElMessageBox.confirm',
      'message.success',
      'this.$message.warning',
    ]) {
      expect(aUiTextRule(makeNode('call-arg', '已封盘', { calleeName }), ctx), calleeName).toBe(
        'A_UI_TEXT',
      )
    }
  })

  it('does not match arguments of other calls, including i18n and debug APIs', () => {
    for (const calleeName of ['t', '$t', 'console.log', 'fetchList', 'router.push']) {
      expect(aUiTextRule(makeNode('call-arg', '已封盘', { calleeName }), ctx), calleeName).toBe(
        null,
      )
    }
    expect(aUiTextRule(makeNode('call-arg', '已封盘'), ctx)).toBe(null)
  })

  it('classifies object-style UI API calls via calleeName on object-value nodes', () => {
    expect(
      aUiTextRule(
        makeNode('object-value', '已封盘', { calleeName: 'showToast', siblingChineseCount: 1 }),
        ctx,
      ),
    ).toBe('A_UI_TEXT')
  })

  it('does not match plain literals or object values without UI context', () => {
    expect(aUiTextRule(makeNode('literal', '中文'), ctx)).toBe(null)
    expect(aUiTextRule(makeNode('object-value', '中文', { siblingChineseCount: 1 }), ctx)).toBe(
      null,
    )
    expect(aUiTextRule(makeNode('object-key', '中文'), ctx)).toBe(null)
  })
})

describe('createUiTextRule (configurable)', () => {
  it('replaces the display attribute whitelist', () => {
    const rule = createUiTextRule({ displayAttrs: ['tip'] })
    expect(rule(makeNode('template-attr', '中文', { attrName: 'tip' }), ctx)).toBe('A_UI_TEXT')
    expect(rule(makeNode('template-attr', '中文', { attrName: 'placeholder' }), ctx)).toBe(null)
  })

  it('replaces the UI API list', () => {
    const rule = createUiTextRule({ uiApis: ['myToast', 'ui.*'] })
    expect(rule(makeNode('call-arg', '中文', { calleeName: 'myToast' }), ctx)).toBe('A_UI_TEXT')
    expect(rule(makeNode('call-arg', '中文', { calleeName: 'ui.alert' }), ctx)).toBe('A_UI_TEXT')
    expect(rule(makeNode('call-arg', '中文', { calleeName: 'showToast' }), ctx)).toBe(null)
  })

  it('keeps template text as A regardless of options', () => {
    const rule = createUiTextRule({ displayAttrs: [], uiApis: [] })
    expect(rule(makeNode('template-text', '中文'), ctx)).toBe('A_UI_TEXT')
  })
})
