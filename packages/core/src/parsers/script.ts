import { Node, Project, SyntaxKind, ts } from 'ts-morph'
import type { ObjectLiteralExpression } from 'ts-morph'

import type { FileContext, SourceLocation, StringKind, StringNode } from '../types'
import { containsChinese } from '../utils/chinese'
import type { LineIndex } from '../utils/line-index'
import { createLineIndex } from '../utils/line-index'

export type ScriptDialect = 'ts' | 'tsx' | 'js' | 'jsx'

export interface ParseScriptOptions {
  /** 源码方言，决定是否按 JSX 解析。省略时按 relativePath 后缀推断 */
  dialect?: ScriptDialect
}

interface WalkState {
  file: string
  lines: LineIndex
  out: StringNode[]
  /** siblingChineseCount 的记忆化：key 是对象字面量或它所在的数组 */
  siblingCache: Map<Node, number>
}

// ---------------------------------------------------------------------------
// Project：进程内复用一个 in-memory Project，避免每个文件都新建语言服务
// ---------------------------------------------------------------------------

let sharedProject: Project | undefined

function getProject(): Project {
  sharedProject ??= new Project({
    useInMemoryFileSystem: true,
    skipLoadingLibFiles: true,
    compilerOptions: {
      allowJs: true,
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.Latest,
    },
  })
  return sharedProject
}

const SCRIPT_KIND: Record<ScriptDialect, ts.ScriptKind> = {
  ts: ts.ScriptKind.TS,
  tsx: ts.ScriptKind.TSX,
  js: ts.ScriptKind.JS,
  jsx: ts.ScriptKind.JSX,
}

const DIALECT_BY_EXT: Record<string, ScriptDialect> = {
  '.ts': 'ts',
  '.mts': 'ts',
  '.cts': 'ts',
  '.tsx': 'tsx',
  '.js': 'js',
  '.mjs': 'js',
  '.cjs': 'js',
  '.jsx': 'jsx',
}

/** 按文件后缀推断方言；未知后缀按 TS 处理（TS 是 JS 的超集，且不会把 `<` 当 JSX） */
export function inferDialect(relativePath: string): ScriptDialect {
  const match = /\.[cm]?[jt]sx?$/i.exec(relativePath)
  const ext = match?.[0]?.toLowerCase()
  return (ext !== undefined ? DIALECT_BY_EXT[ext] : undefined) ?? 'ts'
}

/**
 * 解析 .ts / .js / .tsx / .jsx 源码（或 .vue 的 <script> 块内容），返回所有含中文的字符串节点。
 * 判定表见 docs/ts-morph-kinds.md。
 */
export function parseScript(
  source: string,
  ctx: FileContext,
  options: ParseScriptOptions = {},
): StringNode[] {
  const dialect = options.dialect ?? inferDialect(ctx.relativePath)
  const project = getProject()
  const sourceFile = project.createSourceFile(`__i18n_triage__.${dialect}`, source, {
    overwrite: true,
    scriptKind: SCRIPT_KIND[dialect],
  })
  try {
    const state: WalkState = {
      file: ctx.relativePath,
      lines: createLineIndex(source),
      out: [],
      siblingCache: new Map(),
    }
    sourceFile.forEachDescendant((node) => visit(node, state))
    return state.out
  } finally {
    project.removeSourceFile(sourceFile)
  }
}

// ---------------------------------------------------------------------------
// 遍历
// ---------------------------------------------------------------------------

function visit(node: Node, state: WalkState): void {
  if (Node.isJsxText(node)) {
    visitJsxText(node, state)
    return
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    emit(node, node.getLiteralText(), node.getStart(), state)
    return
  }
  if (Node.isTemplateHead(node) || Node.isTemplateMiddle(node) || Node.isTemplateTail(node)) {
    const text = node.getLiteralText()
    if (text.length > 0) emit(node, text, node.getStart(), state)
  }
}

function visitJsxText(node: Node, state: WalkState): void {
  const raw = node.getText()
  const value = raw.replace(/\s+/g, ' ').trim()
  if (!containsChinese(value)) return
  const leading = raw.length - raw.trimStart().length
  state.out.push({
    value,
    kind: 'template-text',
    loc: makeLoc(state, node.getStart() + leading),
  })
}

function emit(literal: Node, value: string, offset: number, state: WalkState): void {
  if (!containsChinese(value)) return

  const expr = climbTransparent(literal)
  const kind = classify(expr)
  if (kind === null) return

  const node: StringNode = { value, kind, loc: makeLoc(state, offset) }

  const calleeName = findEnclosingCalleeName(expr)
  if (calleeName !== undefined) node.calleeName = calleeName

  if (kind === 'template-attr') {
    const attrName = jsxAttrName(expr)
    if (attrName !== undefined) node.attrName = attrName
  }
  if (kind === 'object-value') {
    node.siblingChineseCount = countSiblingChinese(expr, state)
  }

  state.out.push(node)
}

function makeLoc(state: WalkState, offset: number): SourceLocation {
  const { line, column } = state.lines.locate(offset)
  return { file: state.file, line, column, offset }
}

// ---------------------------------------------------------------------------
// 透明包裹层
// ---------------------------------------------------------------------------

/** 括号 / 类型断言 / 非空断言：不改变字面量所处的语义位置 */
function isWrapper(node: Node): boolean {
  return (
    Node.isParenthesizedExpression(node) ||
    Node.isAsExpression(node) ||
    Node.isSatisfiesExpression(node) ||
    Node.isNonNullExpression(node) ||
    Node.isTypeAssertion(node)
  )
}

/** 字符串拼接 / 兜底运算符：两侧操作数都属于整个表达式所在的位置 */
function isConcatOperator(kind: SyntaxKind): boolean {
  return (
    kind === SyntaxKind.PlusToken ||
    kind === SyntaxKind.QuestionQuestionToken ||
    kind === SyntaxKind.BarBarToken
  )
}

/** 判断 parent 是否是 child 的透明层（child 在其中只是「流经」，语义位置由 parent 决定） */
function isTransparentParent(parent: Node, child: Node): boolean {
  if (isWrapper(parent)) return true
  if (Node.isTemplateSpan(parent) || Node.isTemplateExpression(parent)) return true
  if (Node.isConditionalExpression(parent)) return parent.getCondition() !== child
  if (Node.isBinaryExpression(parent)) return isConcatOperator(parent.getOperatorToken().getKind())
  return false
}

/** 从字面量向上跳过所有透明层，返回真正决定 kind 的表达式节点 */
function climbTransparent(node: Node): Node {
  let current = node
  for (;;) {
    const parent = current.getParent()
    if (!parent || !isTransparentParent(parent, current)) return current
    current = parent
  }
}

// ---------------------------------------------------------------------------
// kind 判定（对应 docs/ts-morph-kinds.md 的「父节点 → kind」表）
// ---------------------------------------------------------------------------

function isRequireOrDynamicImport(call: Node): boolean {
  if (!Node.isCallExpression(call)) return false
  const callee = call.getExpression()
  if (callee.getKind() === SyntaxKind.ImportKeyword) return true
  return Node.isIdentifier(callee) && callee.getText() === 'require'
}

function classify(expr: Node): StringKind | null {
  const parent = expr.getParent()
  if (!parent) return 'literal'

  // ---- 完全跳过 ----
  if (
    Node.isImportDeclaration(parent) ||
    Node.isExportDeclaration(parent) ||
    Node.isImportTypeNode(parent) ||
    Node.isExternalModuleReference(parent) ||
    Node.isLiteralTypeNode(parent) ||
    Node.isModuleDeclaration(parent)
  ) {
    return null
  }
  if (
    (Node.isPropertySignature(parent) || Node.isMethodSignature(parent)) &&
    parent.getNameNode() === expr
  ) {
    return null
  }

  // ---- call-arg ----
  if (Node.isCallExpression(parent) || Node.isNewExpression(parent)) {
    if (parent.getExpression() === expr) return 'literal'
    if (isRequireOrDynamicImport(parent)) return null
    return 'call-arg'
  }
  if (Node.isTaggedTemplateExpression(parent)) return 'call-arg'

  // ---- object-value / object-key ----
  if (Node.isPropertyAssignment(parent)) {
    return parent.getInitializer() === expr ? 'object-value' : 'object-key'
  }
  if (Node.isComputedPropertyName(parent)) return 'object-key'
  if (
    (Node.isPropertyDeclaration(parent) ||
      Node.isMethodDeclaration(parent) ||
      Node.isGetAccessorDeclaration(parent) ||
      Node.isSetAccessorDeclaration(parent)) &&
    parent.getNameNode() === expr
  ) {
    return 'object-key'
  }
  if (Node.isArrayLiteralExpression(parent)) {
    const grand = parent.getParent()
    return grand && Node.isPropertyAssignment(grand) && grand.getInitializer() === parent
      ? 'object-value'
      : 'literal'
  }
  if (Node.isElementAccessExpression(parent)) {
    return parent.getArgumentExpression() === expr ? 'object-key' : 'literal'
  }

  // ---- enum-member ----
  if (Node.isEnumMember(parent)) return 'enum-member'

  // ---- JSX ----
  if (Node.isJsxAttribute(parent)) return 'template-attr'
  if (Node.isJsxExpression(parent)) {
    const grand = parent.getParent()
    return grand && Node.isJsxAttribute(grand) ? 'template-attr' : 'literal'
  }

  return 'literal'
}

function jsxAttrName(expr: Node): string | undefined {
  const parent = expr.getParent()
  if (!parent) return undefined
  const attr = Node.isJsxAttribute(parent) ? parent : parent.getParent()
  return attr && Node.isJsxAttribute(attr) ? attr.getNameNode().getText() : undefined
}

// ---------------------------------------------------------------------------
// calleeName
// ---------------------------------------------------------------------------

/** 被调用者的点号全名：showToast / console.error / this.$message.success / api.list.fetch / foo() */
function getCalleeName(callee: Node): string | undefined {
  if (Node.isIdentifier(callee)) return callee.getText()
  if (Node.isThisExpression(callee)) return 'this'
  if (Node.isSuperExpression(callee)) return 'super'
  if (Node.isPropertyAccessExpression(callee)) {
    const base = getCalleeName(callee.getExpression())
    return base === undefined ? undefined : `${base}.${callee.getName()}`
  }
  if (Node.isElementAccessExpression(callee)) {
    const base = getCalleeName(callee.getExpression())
    if (base === undefined) return undefined
    const arg = callee.getArgumentExpression()
    return arg && Node.isStringLiteral(arg) ? `${base}.${arg.getLiteralText()}` : `${base}[]`
  }
  if (Node.isCallExpression(callee)) {
    const base = getCalleeName(callee.getExpression())
    return base === undefined ? undefined : `${base}()`
  }
  if (isWrapper(callee) && Node.isExpression(callee)) {
    const inner = callee.getChildren().find((c) => Node.isExpression(c))
    return inner ? getCalleeName(inner) : undefined
  }
  return undefined
}

/**
 * 从 expr 向上找「把它当实参」的最近调用。
 * 沿途允许经过：对象 / 数组字面量、属性赋值、展开、透明层；
 * 遇到函数边界、语句、声明即停止（回调体里的字符串不属于外层调用）。
 */
function isCallContainer(parent: Node, child: Node): boolean {
  if (isTransparentParent(parent, child)) return true
  return (
    Node.isPropertyAssignment(parent) ||
    Node.isObjectLiteralExpression(parent) ||
    Node.isArrayLiteralExpression(parent) ||
    Node.isSpreadElement(parent) ||
    Node.isSpreadAssignment(parent) ||
    Node.isComputedPropertyName(parent)
  )
}

function findEnclosingCalleeName(expr: Node): string | undefined {
  let current = expr
  for (;;) {
    const parent = current.getParent()
    if (!parent) return undefined
    if (Node.isCallExpression(parent) || Node.isNewExpression(parent)) {
      if (parent.getExpression() === current) return undefined
      return getCalleeName(parent.getExpression())
    }
    if (Node.isTaggedTemplateExpression(parent)) return getCalleeName(parent.getTag())
    if (!isCallContainer(parent, current)) return undefined
    current = parent
  }
}

// ---------------------------------------------------------------------------
// siblingChineseCount
// ---------------------------------------------------------------------------

/** 一个属性 initializer 里「含中文的值」有几个：字符串 / 模板算 1，数组按直接字符串元素逐个算 */
function countChineseInValue(init: Node): number {
  let node = init
  while (isWrapper(node)) {
    const inner = node.getChildren().find((c) => Node.isExpression(c))
    if (!inner) break
    node = inner
  }
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    return containsChinese(node.getLiteralText()) ? 1 : 0
  }
  if (Node.isTemplateExpression(node)) {
    const chunks = [node.getHead(), ...node.getTemplateSpans().map((s) => s.getLiteral())]
    return chunks.some((c) => containsChinese(c.getLiteralText())) ? 1 : 0
  }
  if (Node.isConditionalExpression(node)) {
    return countChineseInValue(node.getWhenTrue()) + countChineseInValue(node.getWhenFalse()) > 0
      ? 1
      : 0
  }
  if (Node.isBinaryExpression(node) && isConcatOperator(node.getOperatorToken().getKind())) {
    return countChineseInValue(node.getLeft()) + countChineseInValue(node.getRight()) > 0 ? 1 : 0
  }
  if (Node.isArrayLiteralExpression(node)) {
    let n = 0
    for (const el of node.getElements()) {
      if (Node.isStringLiteral(el) || Node.isNoSubstitutionTemplateLiteral(el)) {
        n += containsChinese(el.getLiteralText()) ? 1 : 0
      } else if (Node.isTemplateExpression(el)) {
        n += countChineseInValue(el)
      }
    }
    return n
  }
  return 0
}

function countChineseValues(obj: ObjectLiteralExpression): number {
  let n = 0
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue
    const init = prop.getInitializer()
    if (init) n += countChineseInValue(init)
  }
  return n
}

/** 找到 object-value 所属的对象字面量（数组元素形态的值也归到属性所在的对象） */
function findOwningObject(expr: Node): ObjectLiteralExpression | undefined {
  const parent = expr.getParent()
  if (!parent) return undefined
  const prop = Node.isArrayLiteralExpression(parent) ? parent.getParent() : parent
  if (!prop || !Node.isPropertyAssignment(prop)) return undefined
  const obj = prop.getParent()
  return obj && Node.isObjectLiteralExpression(obj) ? obj : undefined
}

/**
 * 同一层对象里含中文的 value 总数。
 * 对象本身是数组元素时（options 列表），按整个数组的对象元素合计。不递归进嵌套对象。
 */
function countSiblingChinese(expr: Node, state: WalkState): number {
  const obj = findOwningObject(expr)
  if (!obj) return 0

  const container = obj.getParent()
  const key: Node = container && Node.isArrayLiteralExpression(container) ? container : obj
  const cached = state.siblingCache.get(key)
  if (cached !== undefined) return cached

  let total = 0
  if (Node.isArrayLiteralExpression(key)) {
    for (const el of key.getElements()) {
      if (Node.isObjectLiteralExpression(el)) total += countChineseValues(el)
    }
  } else {
    total = countChineseValues(obj)
  }
  state.siblingCache.set(key, total)
  return total
}
