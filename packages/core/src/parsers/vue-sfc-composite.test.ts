import { describe, expect, it } from 'vitest'

import type { FileContext, StringNode } from '../types'
import { parseSource } from './index'
import { parseVueSfc } from './vue-sfc'

const ctx: FileContext = { relativePath: 'src/views/Order.vue' }

function pick(nodes: StringNode[]) {
  return nodes.map((n) => {
    const out: Record<string, unknown> = { value: n.value, kind: n.kind }
    if (n.calleeName !== undefined) out.calleeName = n.calleeName
    if (n.attrName !== undefined) out.attrName = n.attrName
    return out
  })
}

describe('parseVueSfc — template + script 一起解析', () => {
  const src = [
    `<script setup lang="ts">`, // 1
    `import { showToast } from 'vant'`, // 2
    `// 注释：不该出现`, // 3
    `const title = '脚本标题'`, // 4   引号在第 15 列
    `function save() {`, // 5
    `  showToast('保存成功')`, // 6   引号在第 13 列
    `}`, // 7
    `</script>`, // 8
    ``, // 9
    `<template>`, // 10
    `  <!-- 模板注释 -->`, // 11
    `  <h1 title="标题属性">{{ title }}</h1>`, // 12  引号在第 13 列
    `  <p>正文</p>`, // 13  `正` 在第 6 列
    `</template>`, // 14
    ``, // 15
    `<style scoped>`, // 16
    `h1::after { content: '样式中文'; }`, // 17
    `</style>`, // 18
  ].join('\n')
  const nodes = parseVueSfc(src, ctx)

  it('returns script and template nodes sorted by offset, nothing from comments or <style>', () => {
    expect(pick(nodes)).toEqual([
      { value: '脚本标题', kind: 'literal' },
      { value: '保存成功', kind: 'call-arg', calleeName: 'showToast' },
      { value: '标题属性', kind: 'template-attr', attrName: 'title' },
      { value: '正文', kind: 'template-text' },
    ])
  })

  it('reports script positions in whole-file coordinates', () => {
    const [title, toast] = nodes
    expect(title?.loc).toMatchObject({ line: 4, column: 15, offset: src.indexOf(`'脚本标题'`) })
    expect(toast?.loc).toMatchObject({ line: 6, column: 13, offset: src.indexOf(`'保存成功'`) })
  })

  it('reports template positions in whole-file coordinates', () => {
    const [, , attr, text] = nodes
    expect(attr?.loc).toMatchObject({ line: 12, column: 13, offset: src.indexOf(`"标题属性"`) })
    expect(text?.loc).toMatchObject({ line: 13, column: 6, offset: src.indexOf('正文') })
  })

  it('fills loc.file for every node', () => {
    expect(nodes.every((n) => n.loc.file === 'src/views/Order.vue')).toBe(true)
  })
})

describe('parseVueSfc — 多个 script 块与方言', () => {
  it('parses both <script> and <script setup> blocks', () => {
    const src = `<script lang="ts">
export default { name: '组件名' }
</script>
<script setup lang="ts">
const a = '第二块'
</script>
<template><div>模板</div></template>`
    const nodes = parseVueSfc(src, ctx)
    expect(pick(nodes)).toEqual([
      { value: '组件名', kind: 'object-value' },
      { value: '第二块', kind: 'literal' },
      { value: '模板', kind: 'template-text' },
    ])
    expect(nodes[1]?.loc).toMatchObject({ line: 5, offset: src.indexOf(`'第二块'`) })
  })

  it('parses <script lang="tsx"> with JSX enabled', () => {
    const src = `<script lang="tsx">
export default defineComponent({ render: () => <p title="属性">文本</p> })
</script>`
    expect(pick(parseVueSfc(src, ctx))).toEqual([
      { value: '属性', kind: 'template-attr', attrName: 'title' },
      { value: '文本', kind: 'template-text' },
    ])
  })

  it('parses a plain <script> without lang as JS', () => {
    const src = `<script>
export default { data() { return { msg: '普通脚本' } } }
</script>`
    expect(pick(parseVueSfc(src, ctx))).toEqual([{ value: '普通脚本', kind: 'object-value' }])
  })

  it('returns an empty array for an SFC with neither template nor script content', () => {
    expect(parseVueSfc(`<style>.a { content: '中文' }</style>`, ctx)).toEqual([])
  })
})

describe('parseSource — 按后缀分派', () => {
  it('routes .vue files to the SFC parser', () => {
    const src = `<template><p>模板</p></template>`
    expect(pick(parseSource(src, { relativePath: 'a/B.vue' }))).toEqual([
      { value: '模板', kind: 'template-text' },
    ])
  })

  it('routes .ts / .js / .tsx files to the script parser', () => {
    expect(pick(parseSource(`showToast('提示')`, { relativePath: 'a/b.ts' }))).toEqual([
      { value: '提示', kind: 'call-arg', calleeName: 'showToast' },
    ])
    expect(pick(parseSource(`const a = '值'`, { relativePath: 'a/b.js' }))).toEqual([
      { value: '值', kind: 'literal' },
    ])
    expect(pick(parseSource(`const a = <b>粗体</b>`, { relativePath: 'a/b.tsx' }))).toEqual([
      { value: '粗体', kind: 'template-text' },
    ])
  })
})
