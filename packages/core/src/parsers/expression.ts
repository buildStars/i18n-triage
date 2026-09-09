import { ts } from 'ts-morph'

export interface ExpressionLiteral {
  /** 去掉引号、已解转义的字符串值；模板字符串则是单个静态段 */
  value: string
  /** 字面量节点在表达式字符串内的起点（含引号 / 反引号 / `}`） */
  start: number
  /** 字面量节点在表达式字符串内的终点（不含） */
  end: number
}

/**
 * 用 TypeScript parser 找出一段 JS 表达式（或 v-on 的内联语句）里的所有字符串字面量。
 * 用于 template 的 `{{ }}` 插值与指令表达式。
 *
 * - 普通字符串 / 无插值模板字符串：整个字面量一条
 * - 带 `${}` 的模板字符串：每个非空静态段一条
 * - 注释里的内容不是节点，天然不会被返回
 */
export function extractStringLiterals(expression: string): ExpressionLiteral[] {
  const sourceFile = ts.createSourceFile(
    'expression.ts',
    expression,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  )
  const out: ExpressionLiteral[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push({ value: node.text, start: node.getStart(sourceFile), end: node.getEnd() })
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      if (node.text.length > 0) {
        out.push({ value: node.text, start: node.getStart(sourceFile), end: node.getEnd() })
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return out
}
