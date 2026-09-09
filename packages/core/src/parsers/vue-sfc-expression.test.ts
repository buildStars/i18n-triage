import { describe, expect, it } from 'vitest'

import type { FileContext, StringNode } from '../types'
import { parseVueTemplate } from './vue-sfc'

const ctx: FileContext = { relativePath: 'src/views/Order.vue' }

function pick(nodes: StringNode[]) {
  return nodes.map((n) => {
    const out: Record<string, unknown> = { value: n.value, kind: n.kind }
    if (n.calleeName !== undefined) out.calleeName = n.calleeName
    if (n.attrName !== undefined) out.attrName = n.attrName
    if (n.siblingChineseCount !== undefined) out.siblingChineseCount = n.siblingChineseCount
    return out
  })
}

describe('parseVueTemplate — 模板表达式走 script 解析器，带 kind 与 calleeName', () => {
  it('reports i18n calls inside {{ }} as call-arg with calleeName t / $t', () => {
    const src = `<template>
  <p>{{ t('已封盘') }}</p>
  <p>{{ $t('未封盘') }}</p>
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '已封盘', kind: 'call-arg', calleeName: 't' },
      { value: '未封盘', kind: 'call-arg', calleeName: '$t' },
    ])
  })

  it('reports UI API calls inside event handlers as call-arg with calleeName', () => {
    const src = `<template>
  <van-button @click="showToast('已封盘')">按钮</van-button>
  <van-button @click="() => ElMessage.error('失败')">另一个</van-button>
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '已封盘', kind: 'call-arg', calleeName: 'showToast' },
      { value: '按钮', kind: 'template-text' },
      { value: '失败', kind: 'call-arg', calleeName: 'ElMessage.error' },
      { value: '另一个', kind: 'template-text' },
    ])
  })

  it('keeps conditional operands inside {{ }} as literal', () => {
    const src = `<template><span>{{ ok ? '成功' : '失败' }}</span></template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '成功', kind: 'literal' },
      { value: '失败', kind: 'literal' },
    ])
  })

  it('classifies object literals in bindings as object-value / object-key', () => {
    const src = `<template>
  <div :style="{ content: '中文内容' }" :class="{ '中文类名': active }" v-bind="{ title: '对象绑定' }" />
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '中文内容', kind: 'object-value', attrName: 'content', siblingChineseCount: 1 },
      { value: '中文类名', kind: 'object-key' },
      { value: '对象绑定', kind: 'object-value', attrName: 'title', siblingChineseCount: 1 },
    ])
  })

  it('still treats a single-literal v-bind as template-attr', () => {
    const src = `<template><input :placeholder="'请输入'" /></template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '请输入', kind: 'template-attr', attrName: 'placeholder' },
    ])
  })

  it('handles inline statements in v-on without wrapping them in parentheses', () => {
    const src = `<template><button @click="count++; go('去哪')">x</button></template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '去哪', kind: 'call-arg', calleeName: 'go' },
    ])
  })

  it('reports each Chinese chunk of a template literal in {{ }} as literal', () => {
    const src = '<template><span>{{ `共${total}条` }}</span></template>'
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '共', kind: 'literal' },
      { value: '条', kind: 'literal' },
    ])
  })

  it('keeps whole-file positions for strings inside expressions', () => {
    const src = [
      '<template>', // 1
      `  <p @click="showToast('已封盘')">{{ ok ? '成功' : '失败' }}</p>`, // 2
      '</template>', // 3
    ].join('\n')
    const nodes = parseVueTemplate(src, ctx)
    const byValue = (v: string) => nodes.find((n) => n.value === v)
    expect(byValue('已封盘')?.loc).toMatchObject({ line: 2, offset: src.indexOf(`'已封盘'`) })
    expect(byValue('已封盘')?.loc.column).toBe(src.indexOf(`'已封盘'`) - src.indexOf('\n'))
    expect(byValue('成功')?.loc).toMatchObject({ line: 2, offset: src.indexOf(`'成功'`) })
    expect(byValue('失败')?.loc).toMatchObject({ line: 2, offset: src.indexOf(`'失败'`) })
  })

  it('does not report expressions without Chinese and never reports comments', () => {
    const src = `<template>
  <!-- {{ t('注释里') }} -->
  <p :class="active ? 'on' : 'off'" @click="go('home')">{{ label }}</p>
</template>`
    expect(parseVueTemplate(src, ctx)).toEqual([])
  })
})
