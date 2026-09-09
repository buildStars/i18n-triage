import { describe, expect, it } from 'vitest'

import type { FileContext, StringNode } from '../types'
import { parseVueTemplate } from './vue-sfc'

const ctx: FileContext = { relativePath: 'src/views/Order.vue' }

/** 只挑关心的字段，方便整体断言 */
function pick(nodes: StringNode[]) {
  return nodes.map((n) => ({
    value: n.value,
    kind: n.kind,
    ...(n.attrName !== undefined ? { attrName: n.attrName } : {}),
  }))
}

describe('parseVueTemplate — 文本节点', () => {
  it('reports Chinese text nodes as template-text with trimmed value', () => {
    const src = `<template>
  <div>
    暂无数据
  </div>
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([{ value: '暂无数据', kind: 'template-text' }])
  })

  it('reports text nodes nested inside v-if / v-else / v-for elements', () => {
    const src = `<template>
  <p v-if="ok">已封盘</p>
  <p v-else>未封盘</p>
  <li v-for="item in list" :key="item.id">{{ item.name }} 件</li>
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '已封盘', kind: 'template-text' },
      { value: '未封盘', kind: 'template-text' },
      { value: '件', kind: 'template-text' },
    ])
  })

  it('ignores text nodes without Chinese', () => {
    const src = `<template><div>Hello {{ name }}</div></template>`
    expect(parseVueTemplate(src, ctx)).toEqual([])
  })
})

describe('parseVueTemplate — 静态属性', () => {
  it('reports Chinese static attribute values as template-attr with attrName', () => {
    const src = `<template>
  <input class="wrap" placeholder="请输入订单号" :maxlength="10" />
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '请输入订单号', kind: 'template-attr', attrName: 'placeholder' },
    ])
  })

  it('reports kebab-case component props such as confirm-button-text', () => {
    const src = `<template>
  <van-dialog confirm-button-text="确定" cancel-button-text="取消" data-id="x" />
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '确定', kind: 'template-attr', attrName: 'confirm-button-text' },
      { value: '取消', kind: 'template-attr', attrName: 'cancel-button-text' },
    ])
  })

  it('treats a bound attribute whose whole expression is one string literal as template-attr', () => {
    const src = `<template>
  <input :placeholder="'请输入'" v-bind:title="'标题'" />
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '请输入', kind: 'template-attr', attrName: 'placeholder' },
      { value: '标题', kind: 'template-attr', attrName: 'title' },
    ])
  })
})

describe('parseVueTemplate — HTML 注释必须完全排除', () => {
  it('ignores a single-line comment containing Chinese', () => {
    const src = `<template>
  <!-- 这是注释 -->
  <div>正文</div>
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([{ value: '正文', kind: 'template-text' }])
  })

  it('ignores multi-line comments and markup inside comments', () => {
    const src = `<template>
  <div>
    <!--
      <p title="注释里的属性">注释里的元素</p>
      {{ '注释里的插值' }}
    -->
    <span>正文</span>
  </div>
</template>`
    const nodes = parseVueTemplate(src, ctx)
    expect(pick(nodes)).toEqual([{ value: '正文', kind: 'template-text' }])
    expect(nodes.some((n) => n.value.includes('注释'))).toBe(false)
  })

  it('returns nothing when the template only contains comments', () => {
    const src = `<template>
  <!-- 待办：补充空态文案 -->
  <div />
</template>`
    expect(parseVueTemplate(src, ctx)).toEqual([])
  })
})

describe('parseVueTemplate — <style> 与 <script> 块不扫', () => {
  it('does not scan Chinese inside <style>', () => {
    const src = `<template>
  <div class="tip">提示</div>
</template>

<style scoped>
.tip::after { content: '样式里的中文'; }
/* 样式注释 */
</style>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([{ value: '提示', kind: 'template-text' }])
  })

  it('does not scan the <script> block (that is the script parser’s job)', () => {
    const src = `<script setup lang="ts">
const msg = '脚本里的中文'
</script>

<template>
  <div>{{ msg }}</div>
</template>`
    expect(parseVueTemplate(src, ctx)).toEqual([])
  })

  it('returns an empty array when there is no <template> block', () => {
    const src = `<script setup lang="ts">
const msg = '只有脚本'
</script>`
    expect(parseVueTemplate(src, ctx)).toEqual([])
  })
})

describe('parseVueTemplate — 插值与指令表达式里的字符串字面量', () => {
  it('reports string literals inside {{ }} as literal', () => {
    const src = `<template>
  <span>{{ ok ? '成功' : '失败' }}</span>
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '成功', kind: 'literal' },
      { value: '失败', kind: 'literal' },
    ])
  })

  it('reports static chunks of template literals inside {{ }}', () => {
    const src = '<template><span>{{ `共${total}条` }}</span></template>'
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '共', kind: 'literal' },
      { value: '条', kind: 'literal' },
    ])
  })

  it('reports string literals inside event handlers and complex bindings as literal', () => {
    const src = `<template>
  <van-button :title="isVip ? '会员' : '游客'" @click="go('去哪')">按钮</van-button>
</template>`
    expect(pick(parseVueTemplate(src, ctx))).toEqual([
      { value: '会员', kind: 'literal' },
      { value: '游客', kind: 'literal' },
      { value: '去哪', kind: 'literal' },
      { value: '按钮', kind: 'template-text' },
    ])
  })

  it('does not report identifiers or non-Chinese literals inside expressions', () => {
    const src = `<template><span :class="active ? 'on' : 'off'">{{ label }}</span></template>`
    expect(parseVueTemplate(src, ctx)).toEqual([])
  })
})

describe('parseVueTemplate — 位置信息相对整个 .vue 文件', () => {
  // 行号从 1 开始；<script> 块占 1~3 行，第 4 行空行，<template> 在第 5 行
  const src = [
    '<script setup lang="ts">', // 1
    'const ok = true', // 2
    '</script>', // 3
    '', // 4
    '<template>', // 5
    '  <div title="标题">', // 6   `"标题"` 的引号在第 14 列
    '    暂无数据', // 7   `暂` 在第 5 列
    "    <span>{{ ok ? '成功' : '失败' }}</span>", // 8   `'成功'` 引号在第 19 列，`'失败'` 在第 26 列
    '  </div>', // 9
    '</template>', // 10
  ].join('\n')

  const nodes = parseVueTemplate(src, ctx)
  const byValue = (v: string) => {
    const n = nodes.find((x) => x.value === v)
    if (!n) throw new Error(`missing node ${v}`)
    return n
  }

  it('fills loc.file from the file context', () => {
    expect(nodes.every((n) => n.loc.file === 'src/views/Order.vue')).toBe(true)
  })

  it('template-attr points at the opening quote of the attribute value, in whole-file coordinates', () => {
    const attr = byValue('标题')
    expect(attr.loc.offset).toBe(src.indexOf('"标题"'))
    expect(attr.loc).toMatchObject({ line: 6, column: 14 })
  })

  it('template-text points at the first non-whitespace character, not the leading newline', () => {
    const text = byValue('暂无数据')
    expect(text.loc.offset).toBe(src.indexOf('暂无数据'))
    expect(text.loc).toMatchObject({ line: 7, column: 5 })
  })

  it('literal inside {{ }} points at the opening quote, offset by the interpolation position', () => {
    const ok = byValue('成功')
    const fail = byValue('失败')
    expect(ok.loc.offset).toBe(src.indexOf("'成功'"))
    expect(ok.loc).toMatchObject({ line: 8, column: 19 })
    expect(fail.loc.offset).toBe(src.indexOf("'失败'"))
    expect(fail.loc).toMatchObject({ line: 8, column: 26 })
  })

  it('offset is consistent with line/column for every node', () => {
    for (const n of nodes) {
      const lineStart =
        src
          .split('\n')
          .slice(0, n.loc.line - 1)
          .join('\n').length + (n.loc.line > 1 ? 1 : 0)
      expect(lineStart + n.loc.column - 1).toBe(n.loc.offset)
    }
  })

  it('keeps whole-file offsets when the template comes before the script', () => {
    const swapped = [
      '<template>',
      '  <p>提示</p>',
      '</template>',
      '',
      '<script setup>',
      "const a = '脚本'",
      '</script>',
    ].join('\n')
    const [tip] = parseVueTemplate(swapped, ctx)
    expect(tip?.value).toBe('提示')
    expect(tip?.loc.offset).toBe(swapped.indexOf('提示'))
    expect(tip?.loc).toMatchObject({ line: 2, column: 6 })
  })
})
