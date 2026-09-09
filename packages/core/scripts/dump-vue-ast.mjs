// 开发辅助脚本：把一个 .vue 的 template AST dump 成可读结构，用于摸清 @vue/compiler-dom 的节点形状。
// 对照表见 docs/vue-template-ast.md。运行：node packages/core/scripts/dump-vue-ast.mjs
import { parse as parseSfc } from '@vue/compiler-sfc'
import { NodeTypes, compile, parse as parseDom } from '@vue/compiler-dom'

const SAMPLE = `<script setup lang="ts">
const ok = true
</script>

<template>
  <!-- 顶部注释 -->
  <div class="wrap" title="标题">
    暂无数据
    <input placeholder="请输入订单号" :maxlength="10" />
    <span>{{ ok ? '成功' : '失败' }}</span>
    <p v-if="ok">已封盘</p>
    <p v-else>未封盘</p>
    <li v-for="item in list" :key="item.id">{{ item.name }} 件</li>
    <van-button confirm-button-text="确定" :title="'绑定标题'" @click="go('去哪')">按钮 {{ count }} 个</van-button>
  </div>
</template>

<style scoped>
.wrap::after { content: '中文样式'; }
</style>
`

const typeName = (t) => NodeTypes[t] ?? String(t)

/** 把 AST 节点压成只保留关心字段的可读结构 */
function slim(node, depth = 0) {
  if (node == null || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map((n) => slim(n, depth))
  const out = { type: typeName(node.type) }
  if (node.tag !== undefined) out.tag = node.tag
  if (node.name !== undefined) out.name = node.name
  if (node.rawName !== undefined) out.rawName = node.rawName
  if (typeof node.content === 'string') out.content = node.content
  if (node.isStatic !== undefined) out.isStatic = node.isStatic
  if (node.loc) {
    out.loc = `${node.loc.start.line}:${node.loc.start.column}@${node.loc.start.offset}-${node.loc.end.offset}`
    out.locSource = node.loc.source
  }
  if (node.value !== undefined && typeof node.value === 'object')
    out.value = slim(node.value, depth + 1)
  if (node.content && typeof node.content === 'object') out.content = slim(node.content, depth + 1)
  if (node.arg) out.arg = slim(node.arg, depth + 1)
  if (node.exp) out.exp = slim(node.exp, depth + 1)
  if (node.props?.length) out.props = slim(node.props, depth + 1)
  if (node.branches?.length) out.branches = slim(node.branches, depth + 1)
  if (node.condition) out.condition = slim(node.condition, depth + 1)
  if (node.source) out.source = slim(node.source, depth + 1)
  if (node.children?.length) out.children = slim(node.children, depth + 1)
  if (node.codegenNode) out.codegenNode = `<${typeName(node.codegenNode.type)}>`
  return out
}

const { descriptor, errors } = parseSfc(SAMPLE, { filename: 'Sample.vue' })
console.log('=== SFC parse errors ===', errors)
console.log('=== descriptor blocks ===')
for (const b of [
  descriptor.script,
  descriptor.scriptSetup,
  descriptor.template,
  ...descriptor.styles,
]) {
  if (!b) continue
  console.log(
    `${b.type.padEnd(8)} loc ${b.loc.start.line}:${b.loc.start.column}@${b.loc.start.offset}-${b.loc.end.offset}`,
    'attrs=',
    b.attrs,
  )
}

const tpl = descriptor.template
console.log('\n=== descriptor.template.ast (sfc parse 自带的 AST，检查 loc 是否相对整个文件) ===')
console.log(JSON.stringify(slim(tpl.ast), null, 2))

console.log('\n=== compiler-dom parse(template.content) 原始 AST（loc 相对 template 内容） ===')
const raw = parseDom(tpl.content, { comments: true })
console.log(JSON.stringify(slim(raw), null, 2))

console.log(
  '\n=== compiler-dom compile(template.content, { prefixIdentifiers: false }).ast（transform 后） ===',
)
const compiled = compile(tpl.content, { prefixIdentifiers: false, comments: true })
console.log(JSON.stringify(slim(compiled.ast), null, 2))

console.log('\n=== NodeTypes enum ===')
console.log(
  Object.entries(NodeTypes)
    .filter(([k]) => Number.isNaN(Number(k)))
    .map(([k, v]) => `${v}=${k}`)
    .join(' '),
)
