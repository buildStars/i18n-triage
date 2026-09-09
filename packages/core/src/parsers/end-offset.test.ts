/**
 * `loc.endOffset`（0-based，不含）：--fix 做精确替换需要每个节点的结束位置。
 * 约定与起点一致：字符串字面量含引号；模板属性值含引号；文本节点是去掉首尾空白后的原始文本。
 */
import { describe, expect, it } from 'vitest'

import type { FileContext } from '../types'
import { parseScript } from './script'
import { parseVueSfc, parseVueTemplate } from './vue-sfc'

const ctx: FileContext = { relativePath: 'src/views/Order.vue' }

const slice = (src: string, node: { loc: { offset: number; endOffset?: number } }) =>
  src.slice(node.loc.offset, node.loc.endOffset)

describe('endOffset — script', () => {
  it('covers the whole string literal including quotes', () => {
    const src = `showToast('保存成功'); const o = { label: "联盟" }`
    const [a, b] = parseScript(src, ctx)
    expect(slice(src, a!)).toBe(`'保存成功'`)
    expect(slice(src, b!)).toBe(`"联盟"`)
  })

  it('covers escaped quotes and a no-substitution template literal', () => {
    const src = `f('他说\\'好\\''); g(\`模板\`)`
    const [a, b] = parseScript(src, ctx)
    expect(slice(src, a!)).toBe(`'他说\\'好\\''`)
    expect(slice(src, b!)).toBe('`模板`')
  })

  it('covers template chunks including their delimiters', () => {
    const src = 'f(`共${n}条`)'
    const [head, tail] = parseScript(src, ctx)
    expect(slice(src, head!)).toBe('`共${')
    expect(slice(src, tail!)).toBe('}条`')
  })

  it('covers identifier keys and JSX text without surrounding whitespace', () => {
    const src = `const m = { 待支付: 0 }`
    expect(slice(src, parseScript(src, ctx)[0]!)).toBe('待支付')
    const jsx = `const el = <p>\n  当前共 {n} 条\n</p>`
    const [text, tail] = parseScript(jsx, { relativePath: 'a.tsx' })
    expect(slice(jsx, text!)).toBe('当前共')
    expect(slice(jsx, tail!)).toBe('条')
  })
})

describe('endOffset — template', () => {
  it('covers trimmed text nodes and quoted attribute values', () => {
    const src = `<template>
  <div title="标题">
    暂无数据
  </div>
</template>`
    const [attr, text] = parseVueTemplate(src, ctx)
    expect(slice(src, attr!)).toBe(`"标题"`)
    expect(slice(src, text!)).toBe('暂无数据')
  })

  it('covers the literal inside a bound attribute and inside {{ }}', () => {
    const src = `<template><input :placeholder="'请输入'" :title="ok ? '成功' : '失败'" /></template>`
    const [bound, ok, fail] = parseVueTemplate(src, ctx)
    expect(slice(src, bound!)).toBe(`'请输入'`)
    expect(slice(src, ok!)).toBe(`'成功'`)
    expect(slice(src, fail!)).toBe(`'失败'`)
  })

  it('is whole-file for script blocks in an SFC', () => {
    const src = `<script setup lang="ts">\nconst a = '脚本'\n</script>\n<template><p>模板</p></template>`
    const [script, text] = parseVueSfc(src, ctx)
    expect(slice(src, script!)).toBe(`'脚本'`)
    expect(slice(src, text!)).toBe('模板')
  })
})
