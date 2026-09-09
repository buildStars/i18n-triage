import { describe, expect, it } from 'vitest'

import type { FileContext, StringNode } from '../types'
import { parseScript } from './script'
import { parseVueTemplate } from './vue-sfc'

const ctx: FileContext = { relativePath: 'src/views/Order.vue' }
const pick = (nodes: StringNode[]) =>
  nodes.map((n) => ({ value: n.value, kind: n.kind, attrName: n.attrName }))

describe('parseScript — object-value 记录所属属性名到 attrName', () => {
  it('records identifier and string-literal property names', () => {
    expect(
      pick(parseScript(`const o = { label: '联盟', 'msg': '消息', 123: '数字键' }`, ctx)),
    ).toEqual([
      { value: '联盟', kind: 'object-value', attrName: 'label' },
      { value: '消息', kind: 'object-value', attrName: 'msg' },
      { value: '数字键', kind: 'object-value', attrName: '123' },
    ])
  })

  it('leaves attrName undefined for computed property names', () => {
    const [node] = parseScript(`const o = { [KEY]: '值' }`, ctx)
    expect(node).toMatchObject({ value: '值', kind: 'object-value' })
    expect(node?.attrName).toBeUndefined()
  })

  it('uses the owning property for array elements and template chunks', () => {
    expect(pick(parseScript("const o = { tags: ['一', '二'], label: `第${n}期` }", ctx))).toEqual([
      { value: '一', kind: 'object-value', attrName: 'tags' },
      { value: '二', kind: 'object-value', attrName: 'tags' },
      { value: '第', kind: 'object-value', attrName: 'label' },
      { value: '期', kind: 'object-value', attrName: 'label' },
    ])
  })

  it('records the property name for form rules inside reactive()', () => {
    const src = `const rules = reactive({ name: [{ required: true, message: '供应商不能为空' }] })`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '供应商不能为空', kind: 'object-value', attrName: 'message' },
    ])
  })

  it('does not set attrName on other kinds', () => {
    const nodes = parseScript(`showToast('提示'); const v = '裸'; const k = { '键': 1 }`, ctx)
    expect(nodes.every((n) => n.attrName === undefined)).toBe(true)
  })

  it('applies to object literals inside template bindings too', () => {
    const nodes = parseVueTemplate(
      `<template><div :style="{ content: '中文内容' }" /></template>`,
      ctx,
    )
    expect(pick(nodes)).toEqual([{ value: '中文内容', kind: 'object-value', attrName: 'content' }])
  })
})
