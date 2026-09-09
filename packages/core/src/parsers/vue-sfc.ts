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

import type { FileContext, SourceLocation, StringNode } from '../types'
import { containsChinese } from '../utils/chinese'
import type { LineIndex } from '../utils/line-index'
import { createLineIndex } from '../utils/line-index'
import { extractStringLiterals } from './expression'

interface WalkState {
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
  const ast = descriptor.template?.ast
  if (!ast) return []

  const state: WalkState = { file: ctx.relativePath, lines: createLineIndex(source), out: [] }
  visitChildren(ast.children, state)
  return state.out
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
  for (const lit of extractStringLiterals(exp.content)) {
    if (!containsChinese(lit.value)) continue
    state.out.push({
      value: lit.value,
      kind: 'literal',
      loc: makeLoc(state, exp.loc.start.offset + lit.start),
    })
  }
}

function visitDirective(node: DirectiveNode, state: WalkState): void {
  const exp = node.exp
  if (!exp || exp.type !== NodeTypes.SIMPLE_EXPRESSION) return

  const literals = extractStringLiterals(exp.content)
  if (literals.length === 0) return

  // `:placeholder="'请输入'"`：整个表达式就是一个字符串字面量，等价于静态属性
  const first = literals[0]
  const leading = exp.content.length - exp.content.trimStart().length
  const isWholeLiteral =
    literals.length === 1 &&
    first !== undefined &&
    first.start === leading &&
    first.end - first.start === exp.content.trim().length
  const staticArg =
    node.name === 'bind' && node.arg?.type === NodeTypes.SIMPLE_EXPRESSION && node.arg.isStatic
      ? node.arg.content
      : undefined

  for (const lit of literals) {
    if (!containsChinese(lit.value)) continue
    const loc = makeLoc(state, exp.loc.start.offset + lit.start)
    if (isWholeLiteral && staticArg !== undefined) {
      state.out.push({ value: lit.value, kind: 'template-attr', attrName: staticArg, loc })
    } else {
      state.out.push({ value: lit.value, kind: 'literal', loc })
    }
  }
}
