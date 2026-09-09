import { NodeTypes } from '@vue/compiler-dom'
import type {
  AttributeNode,
  DirectiveNode,
  ElementNode,
  InterpolationNode,
  TemplateChildNode,
  TextNode,
} from '@vue/compiler-dom'
import { parse as parseSfc } from '@vue/compiler-sfc'
import type { SFCDescriptor, SFCScriptBlock } from '@vue/compiler-sfc'

import type { FileContext, SourceLocation, StringNode } from '../types'
import { containsChinese } from '../utils/chinese'
import type { LineIndex } from '../utils/line-index'
import { createLineIndex } from '../utils/line-index'
import { extractStringLiterals } from './expression'
import type { ScriptDialect } from './script'
import { parseScript } from './script'

interface WalkState {
  source: string
  ctx: FileContext
  file: string
  lines: LineIndex
  out: StringNode[]
}

/**
 * 解析 .vue 源码的 `<template>` 块，返回所有含中文的字符串节点。
 *
 * - 只看 template；`<script>` 交给 script 解析器，`<style>` / 自定义块不扫
 * - 位置信息相对**整个 .vue 文件**（`descriptor.template.ast` 本身就是整文件坐标，见 docs/vue-template-ast.md）
 * - HTML 注释整棵跳过
 */
export function parseVueTemplate(source: string, ctx: FileContext): StringNode[] {
  const { descriptor } = parseSfc(source, { filename: ctx.relativePath, sourceMap: false })
  return collectTemplateNodes(descriptor, source, ctx)
}

/**
 * 解析整个 .vue：`<template>` + 所有 `<script>` / `<script setup>` 块，按 offset 排序。
 * script 块通过「遮罩整文件其余部分」交给 parseScript，位置天然是整文件坐标。
 */
export function parseVueSfc(source: string, ctx: FileContext): StringNode[] {
  const { descriptor } = parseSfc(source, { filename: ctx.relativePath, sourceMap: false })
  const nodes = collectTemplateNodes(descriptor, source, ctx)

  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block || block.src !== undefined) continue // 外链 <script src> 没有内容可扫
    const masked = maskOutside(source, block.loc.start.offset, block.loc.end.offset)
    nodes.push(...parseScript(masked, ctx, { dialect: dialectFromLang(block.lang) }))
  }

  return nodes.sort((a, b) => a.loc.offset - b.loc.offset)
}

function dialectFromLang(lang: SFCScriptBlock['lang']): ScriptDialect {
  switch (lang) {
    case 'ts':
      return 'ts'
    case 'tsx':
      return 'tsx'
    case 'jsx':
      return 'jsx'
    default:
      return 'js'
  }
}

/** 把 [start, end) 之外的字符全部替换成空格，保留换行，使长度与行结构不变 */
function maskOutside(source: string, start: number, end: number): string {
  const blank = (s: string): string => s.replace(/[^\r\n]/g, ' ')
  return blank(source.slice(0, start)) + source.slice(start, end) + blank(source.slice(end))
}

function collectTemplateNodes(
  descriptor: SFCDescriptor,
  source: string,
  ctx: FileContext,
): StringNode[] {
  const ast = descriptor.template?.ast
  if (!ast) return []
  const state: WalkState = {
    source,
    ctx,
    file: ctx.relativePath,
    lines: createLineIndex(source),
    out: [],
  }
  visitChildren(ast.children, state)
  return state.out
}

/**
 * 把模板里的一段 JS 表达式交给 script 解析器：遮罩整文件其余部分，只留 [start, end)，
 * 这样拿到的 kind / calleeName / siblingChineseCount 与 script 完全一致，位置也天然是整文件坐标。
 *
 * `wrapInParens`：`{{ }}` 与 `:bind` 是表达式，包一层括号避免 `{ a: 'x' }` 被当成语句块；
 * `v-on` 允许内联语句（`count++; go()`），不能包。括号只写到被遮罩成空格的槽位上，绝不动换行。
 */
function parseTemplateExpression(
  state: WalkState,
  start: number,
  end: number,
  wrapInParens: boolean,
): StringNode[] {
  let masked = maskOutside(state.source, start, end)
  if (wrapInParens) {
    const open = findBlankSlot(masked, start - 1, -1)
    const close = findBlankSlot(masked, end, 1)
    if (open !== -1 && close !== -1) {
      masked = `${masked.slice(0, open)}(${masked.slice(open + 1, close)})${masked.slice(close + 1)}`
    }
  }
  return parseScript(masked, state.ctx, { dialect: 'ts' })
}

/** 从 from 开始按 step 方向找第一个不是换行的（已遮罩的）位置；找不到返回 -1 */
function findBlankSlot(masked: string, from: number, step: 1 | -1): number {
  for (let i = from; i >= 0 && i < masked.length; i += step) {
    const ch = masked[i]
    if (ch !== '\n' && ch !== '\r') return i
  }
  return -1
}

function makeLoc(state: WalkState, offset: number): SourceLocation {
  const { line, column } = state.lines.locate(offset)
  return { file: state.file, line, column, offset }
}

function visitChildren(children: TemplateChildNode[], state: WalkState): void {
  for (const child of children) visitNode(child, state)
}

function visitNode(node: TemplateChildNode, state: WalkState): void {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      visitElement(node, state)
      break
    case NodeTypes.TEXT:
      visitText(node, state)
      break
    case NodeTypes.INTERPOLATION:
      visitInterpolation(node, state)
      break
    case NodeTypes.COMMENT:
      // <!-- --> 整棵跳过：注释里的中文不是文案
      break
    default:
      // IF / FOR / COMPOUND_EXPRESSION / TEXT_CALL 只在 transform 之后出现，原始 parse AST 不会有
      break
  }
}

function visitElement(node: ElementNode, state: WalkState): void {
  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) visitAttribute(prop, state)
    else visitDirective(prop, state)
  }
  visitChildren(node.children, state)
}

function visitText(node: TextNode, state: WalkState): void {
  const value = node.content.trim()
  if (!containsChinese(value)) return
  // content 已被 condense 压缩空白；位置用原始 loc.source 里第一个非空白字符
  const raw = node.loc.source
  const leading = raw.length - raw.trimStart().length
  state.out.push({
    value,
    kind: 'template-text',
    loc: makeLoc(state, node.loc.start.offset + leading),
  })
}

function visitAttribute(node: AttributeNode, state: WalkState): void {
  if (!node.value) return
  const value = node.value.content
  if (!containsChinese(value)) return
  // value.loc 含引号，起点即引号位置
  state.out.push({
    value,
    kind: 'template-attr',
    attrName: node.name,
    loc: makeLoc(state, node.value.loc.start.offset),
  })
}

function visitInterpolation(node: InterpolationNode, state: WalkState): void {
  const exp = node.content
  if (exp.type !== NodeTypes.SIMPLE_EXPRESSION) return
  if (!containsChinese(exp.content)) return
  state.out.push(...parseTemplateExpression(state, exp.loc.start.offset, exp.loc.end.offset, true))
}

function visitDirective(node: DirectiveNode, state: WalkState): void {
  const exp = node.exp
  if (!exp || exp.type !== NodeTypes.SIMPLE_EXPRESSION) return
  if (!containsChinese(exp.content)) return

  // `:placeholder="'请输入'"`：整个表达式就是一个字符串字面量，等价于静态属性
  const staticArg =
    node.name === 'bind' && node.arg?.type === NodeTypes.SIMPLE_EXPRESSION && node.arg.isStatic
      ? node.arg.content
      : undefined
  if (staticArg !== undefined) {
    const literals = extractStringLiterals(exp.content)
    const first = literals[0]
    const leading = exp.content.length - exp.content.trimStart().length
    if (
      literals.length === 1 &&
      first !== undefined &&
      first.start === leading &&
      first.end - first.start === exp.content.trim().length
    ) {
      state.out.push({
        value: first.value,
        kind: 'template-attr',
        attrName: staticArg,
        loc: makeLoc(state, exp.loc.start.offset + first.start),
      })
      return
    }
  }

  // 其余表达式交给 script 解析器；v-on 可能是内联语句，不包括号
  const wrap = node.name !== 'on'
  state.out.push(...parseTemplateExpression(state, exp.loc.start.offset, exp.loc.end.offset, wrap))
}
