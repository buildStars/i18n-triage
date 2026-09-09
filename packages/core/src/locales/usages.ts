import { NodeTypes } from '@vue/compiler-dom'
import type { ElementNode, TemplateChildNode } from '@vue/compiler-dom'
import { parse as parseSfc } from '@vue/compiler-sfc'
import type { SFCScriptBlock } from '@vue/compiler-sfc'
import { Node } from 'ts-morph'
import type { SourceFile } from 'ts-morph'

import { extractStringLiterals } from '../parsers/expression'
import type { ScriptDialect } from '../parsers/script'
import { getCalleeName, inferDialect, withTsMorphSourceFile } from '../parsers/script'
import { maskOutside } from '../parsers/vue-sfc'
import { matchesCallee } from '../rules/callee-match'
import { DEFAULT_I18N_CALLEES } from '../rules/defaults'
import type { FileContext, SourceLocation } from '../types'
import type { LineIndex } from '../utils/line-index'
import { createLineIndex } from '../utils/line-index'

/** 代码里对一个 key 的静态引用：`t('common.ok')`、`<i18n-t keypath="x">` */
export interface KeyUsage {
  key: string
  loc: SourceLocation
  calleeName?: string
}

/** 动态引用：`t(\`order.${s}\`)`（有前缀）或 `t(key)`（无前缀） */
export interface DynamicUsage {
  prefix: string | undefined
  loc: SourceLocation
  calleeName?: string
}

export interface KeyUsages {
  static: KeyUsage[]
  dynamic: DynamicUsage[]
  /**
   * 代码里出现过的所有字符串字面量（去重、按出现顺序）。
   * 路由 `meta.title`、菜单配置里先存 key 再 `t(route.meta.title)` 的用法看不到静态实参，
   * 审计时用它判断「字面量恰好等于 key」→ 不算死 key。
   */
  literals: string[]
}

export interface FindKeyUsagesOptions {
  /** i18n 调用的被调用者模式，默认 DEFAULT_I18N_CALLEES */
  callees?: readonly string[]
  /** 模板里直接写 key 的属性（`<i18n-t keypath>`），默认 ['keypath', 'path'] */
  keyAttrs?: readonly string[]
}

export const DEFAULT_KEY_ATTRS: readonly string[] = ['keypath', 'path']

interface Collector {
  file: string
  lines: LineIndex
  callees: readonly string[]
  keyAttrs: readonly string[]
  out: KeyUsages
  literals: Set<string>
}

function locAt(c: Collector, offset: number, endOffset: number): SourceLocation {
  const { line, column } = c.lines.locate(offset)
  return { file: c.file, line, column, offset, endOffset }
}

/** 在一段（已遮罩到整文件坐标的）脚本里找 i18n 调用 */
function collectFromScript(c: Collector, masked: string, dialect: ScriptDialect): void {
  withTsMorphSourceFile(masked, dialect, (sf: SourceFile) => {
    sf.forEachDescendant((node) => {
      if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
        c.literals.add(node.getLiteralText())
        return
      }
      if (!Node.isCallExpression(node)) return
      const calleeName = getCalleeName(node.getExpression())
      if (calleeName === undefined || !matchesCallee(calleeName, c.callees)) return
      const first = node.getArguments()[0]
      if (!first) return
      if (Node.isStringLiteral(first) || Node.isNoSubstitutionTemplateLiteral(first)) {
        c.out.static.push({
          key: first.getLiteralText(),
          loc: locAt(c, first.getStart(), first.getEnd()),
          calleeName,
        })
        return
      }
      let prefix: string | undefined
      if (Node.isTemplateExpression(first)) {
        const head = first.getHead().getLiteralText()
        prefix = head.length > 0 ? head : undefined
      }
      c.out.dynamic.push({ prefix, loc: locAt(c, first.getStart(), first.getEnd()), calleeName })
    })
  })
}

function collectFromTemplate(c: Collector, source: string, children: TemplateChildNode[]): void {
  for (const child of children) {
    if (child.type !== NodeTypes.ELEMENT) {
      if (
        child.type === NodeTypes.INTERPOLATION &&
        child.content.type === NodeTypes.SIMPLE_EXPRESSION
      ) {
        const { start, end } = child.content.loc
        collectFromScript(c, maskOutside(source, start.offset, end.offset), 'ts')
      }
      continue
    }
    const el: ElementNode = child
    for (const prop of el.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        if (!prop.value) continue
        c.literals.add(prop.value.content)
        if (c.keyAttrs.includes(prop.name)) {
          const start = prop.value.loc.start.offset
          const end = prop.value.loc.end.offset
          c.out.static.push({ key: prop.value.content, loc: locAt(c, start, end) })
        }
        continue
      }
      if (!prop.exp || prop.exp.type !== NodeTypes.SIMPLE_EXPRESSION) continue
      const { start, end } = prop.exp.loc
      // v-t="'key'"：整个表达式就是一个字符串字面量
      if (prop.name === 't') {
        const literals = extractStringLiterals(prop.exp.content)
        const only = literals[0]
        if (
          literals.length === 1 &&
          only &&
          only.end - only.start === prop.exp.content.trim().length
        ) {
          c.out.static.push({
            key: only.value,
            loc: locAt(c, start.offset + only.start, start.offset + only.end),
          })
          continue
        }
      }
      collectFromScript(c, maskOutside(source, start.offset, end.offset), 'ts')
    }
    collectFromTemplate(c, source, el.children)
  }
}

function dialectOf(block: SFCScriptBlock): ScriptDialect {
  switch (block.lang) {
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

/**
 * 找出源码里所有对 i18n key 的引用（不看中文，只看调用形态）。
 * 静态：`t('key')` / `$t("key")` / `i18n.global.t(\`key\`)` 的第一个实参、`<i18n-t keypath="key">`、`v-t="'key'"`。
 * 动态：第一个实参不是字面量——带 `${}` 的模板字符串记下静态前缀，其余记为无前缀。
 * 注释里的调用不是 AST 节点，天然不会被统计。
 */
export function findKeyUsages(
  source: string,
  ctx: FileContext,
  options: FindKeyUsagesOptions = {},
): KeyUsages {
  const c: Collector = {
    file: ctx.relativePath,
    lines: createLineIndex(source),
    callees: options.callees ?? DEFAULT_I18N_CALLEES,
    keyAttrs: options.keyAttrs ?? DEFAULT_KEY_ATTRS,
    out: { static: [], dynamic: [], literals: [] },
    literals: new Set<string>(),
  }

  if (/\.vue$/i.test(ctx.relativePath)) {
    const { descriptor } = parseSfc(source, { filename: ctx.relativePath, sourceMap: false })
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (!block || block.src !== undefined) continue
      collectFromScript(
        c,
        maskOutside(source, block.loc.start.offset, block.loc.end.offset),
        dialectOf(block),
      )
    }
    if (descriptor.template?.ast) collectFromTemplate(c, source, descriptor.template.ast.children)
  } else {
    collectFromScript(c, source, inferDialect(ctx.relativePath))
  }

  const byOffset = (a: { loc: SourceLocation }, b: { loc: SourceLocation }) =>
    a.loc.offset - b.loc.offset
  c.out.static.sort(byOffset)
  c.out.dynamic.sort(byOffset)
  c.out.literals = [...c.literals]
  return c.out
}
