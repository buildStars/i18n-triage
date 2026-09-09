/**
 * Day 7：在 vue-vben-admin / vue-element-plus-admin / yudao-ui-admin-vue3 / RuoYi-Vue3 上跑出来的误判，
 * 每条测试对应 docs/validation.md 里的一条清单项。
 */
import { describe, expect, it } from 'vitest'

import { makeCtx, makeNode } from '../test-utils/make-node'
import { aUiTextRule } from './a-ui-text'
import { cDictRule } from './c-dict'
import { matchesCallee } from './callee-match'
import { createInternalKeyRule, dInternalKeyRule } from './d-internal-key'
import { triage } from './engine'

const ctx = makeCtx()

describe('matchesCallee — 动态成员 X[] 视同 X.*', () => {
  it('matches notification[type]({...}) against notification.*', () => {
    expect(matchesCallee('notification[]', ['notification.*'])).toBe(true)
    expect(matchesCallee('proxy.$modal[]', ['$modal.*'])).toBe(true)
  })

  it('does not let X[] satisfy an exact X pattern', () => {
    expect(matchesCallee('notification[]', ['notification'])).toBe(false)
  })
})

describe('aUiTextRule — 展示属性后缀模式（vben 的 table-title、yudao 的 start-placeholder）', () => {
  it('matches *-text / *-title / *-placeholder / *-tooltip / *-help suffixes', () => {
    for (const attrName of [
      'active-text',
      'inactive-text',
      'element-loading-text',
      'table-title',
      'print-title',
      'start-placeholder',
      'end-placeholder',
      'title-tooltip',
      'table-title-help',
      'startPlaceholder',
    ]) {
      expect(aUiTextRule(makeNode('template-attr', '中文', { attrName }), ctx), attrName).toBe(
        'A_UI_TEXT',
      )
    }
  })

  it('matches the extra exact names found in real projects', () => {
    for (const attrName of ['header', 'desc', 'hint', 'range-separator']) {
      expect(aUiTextRule(makeNode('template-attr', '中文', { attrName }), ctx), attrName).toBe(
        'A_UI_TEXT',
      )
    }
  })

  it('still rejects unrelated attributes', () => {
    for (const attrName of ['id', 'fill', 'data-track', 'value', 'format']) {
      expect(aUiTextRule(makeNode('template-attr', '中文', { attrName }), ctx), attrName).toBe(null)
    }
  })
})

describe('aUiTextRule — object-value 的属性名是展示 prop（reactive 表单 rules、options 列表）', () => {
  it('classifies { label / message / title / placeholder: "中文" } as A by rule', () => {
    for (const attrName of [
      'label',
      'message',
      'title',
      'placeholder',
      'text',
      'startPlaceholder',
    ]) {
      expect(
        aUiTextRule(makeNode('object-value', '中文', { attrName, siblingChineseCount: 1 }), ctx),
        attrName,
      ).toBe('A_UI_TEXT')
    }
  })

  it('leaves object values with other or unknown property names to fallback', () => {
    expect(
      aUiTextRule(
        makeNode('object-value', '中文', { attrName: 'value', siblingChineseCount: 1 }),
        ctx,
      ),
    ).toBe(null)
    expect(aUiTextRule(makeNode('object-value', '中文', { siblingChineseCount: 1 }), ctx)).toBe(
      null,
    )
  })
})

describe('aUiTextRule — 真实项目里的 UI API', () => {
  it('recognises h(), RuoYi $modal, antd notification/Modal, naive dialog, TDesign plugins', () => {
    for (const calleeName of [
      'h',
      'proxy.$modal.msgSuccess',
      'proxy.$modal.confirm',
      'this.$modal.msgError',
      'notification[]',
      'notification.success',
      'Modal.confirm',
      'dialog.warning',
      'MessagePlugin.success',
      'DialogPlugin.confirm',
    ]) {
      expect(aUiTextRule(makeNode('call-arg', '中文', { calleeName }), ctx), calleeName).toBe(
        'A_UI_TEXT',
      )
    }
  })
})

describe('dInternalKeyRule — 非展示属性（设计工具导出的 SVG 图层名、埋点名）', () => {
  it('classifies id / class / key / ref / name / fill / stroke / d / href / src / data-* as D', () => {
    for (const attrName of [
      'id',
      'class',
      'key',
      'ref',
      'name',
      'fill',
      'stroke',
      'd',
      'href',
      'xlink:href',
      'src',
      'data-track',
      'data-id',
    ]) {
      expect(dInternalKeyRule(makeNode('template-attr', '矩形', { attrName }), ctx), attrName).toBe(
        'D_INTERNAL_KEY',
      )
    }
  })

  it('never touches display attributes or text nodes', () => {
    for (const attrName of ['title', 'placeholder', 'label', 'alt', 'aria-label', 'table-title']) {
      expect(dInternalKeyRule(makeNode('template-attr', '中文', { attrName }), ctx), attrName).toBe(
        null,
      )
    }
    expect(dInternalKeyRule(makeNode('template-text', '中文'), ctx)).toBe(null)
    expect(dInternalKeyRule(makeNode('template-attr', '中文'), ctx)).toBe(null)
  })

  it('accepts a custom internal attribute list', () => {
    const rule = createInternalKeyRule({ internalAttrs: ['track-*'] })
    expect(rule(makeNode('template-attr', '中文', { attrName: 'track-event' }), ctx)).toBe(
      'D_INTERNAL_KEY',
    )
    expect(rule(makeNode('template-attr', '中文', { attrName: 'id' }), ctx)).toBe(null)
    expect(rule(makeNode('object-key', '中文'), ctx)).toBe('D_INTERNAL_KEY')
  })
})

describe('cDictRule — consts 目录 / 文件（yudao 的 SimpleProcessDesigner/src/consts.ts）', () => {
  it('treats consts and const as dictionary names', () => {
    const node = makeNode('object-value', '结束', { siblingChineseCount: 5 })
    expect(cDictRule(node, makeCtx('src/components/designer/src/consts.ts'))).toBe('C_DICT')
    expect(cDictRule(node, makeCtx('src/const/status.ts'))).toBe('C_DICT')
  })
})

describe('engine — 新属性规则的优先级', () => {
  it('id="矩形" is D, title="标题" is A, data-track is D, unknown attr stays fallback A', () => {
    const results = triage(
      [
        makeNode('template-attr', '矩形', { attrName: 'id' }),
        makeNode('template-attr', '标题', { attrName: 'title' }),
        makeNode('template-attr', '埋点', { attrName: 'data-track' }),
        makeNode('template-attr', '中文', { attrName: 'format' }),
      ],
      ctx,
    )
    expect(results.map((r) => `${r.category}/${r.matchedBy}`)).toEqual([
      'D_INTERNAL_KEY/d-internal-key',
      'A_UI_TEXT/a-ui-text',
      'D_INTERNAL_KEY/d-internal-key',
      'A_UI_TEXT/fallback',
    ])
  })

  it('a form rule message inside reactive() is confident A, not fallback', () => {
    const node = makeNode('object-value', '供应商不能为空', {
      attrName: 'message',
      calleeName: 'reactive',
      siblingChineseCount: 1,
    })
    expect(triage([node], ctx)[0]).toMatchObject({ category: 'A_UI_TEXT', matchedBy: 'a-ui-text' })
  })
})
