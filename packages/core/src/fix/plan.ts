import { NodeTypes } from '@vue/compiler-dom'
import type { ElementNode, RootNode, TemplateChildNode } from '@vue/compiler-dom'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { ts } from 'ts-morph'

import type { FileContext, StringNode, TriageResult } from '../types'
import type { TextEdit } from './edits'
import { applyEdits } from './edits'
import type { KeyStyle } from './keys'
import { hashKey, makeKey, quoteJs } from './keys'

export interface FixOptions {
  /** key 生成策略，默认 'text'（中文即 key） */
  keyStyle?: KeyStyle
  /** 模板里用的翻译函数，默认 `$t`（vue-i18n 的全局注入） */
  templateFn?: string
  /** 脚本里用的翻译函数，默认 `t` */
  scriptFn?: string
  /** 非 `<script setup>` 的脚本（options API、.ts / .js）默认跳过；开启后也替换，并假定 scriptFn 在作用域内 */
  fixPlainScripts?: boolean
  /** `<script setup>` 里没有 `t` 时自动补 `import { useI18n } from 'vue-i18n'` + `const { t } = useI18n()`，默认 true */
  ensureUseI18n?: boolean
  /** 连「待确认」（fallback）的 A 类也替换，默认 false */
  includeUnsure?: boolean
  /** 已有语言包（key → 文案）：文案已存在时复用其 key */
  existingKeys?: ReadonlyMap<string, string>
}

export type FixSkipReason =
  | 'unsure'
  | 'concatenation'
  | 'template-literal'
  | 'no-t-in-scope'
  | 'jsx'
  | 'missing-range'
  | 'unsupported'

export interface FixSkip {
  node: StringNode
  reason: FixSkipReason
}

export interface FixPlan {
  file: string
  edits: TextEdit[]
  /** 本文件新增的 key → 文案（复用 existingKeys 的不在此列） */
  keys: Map<string, string>
  skipped: FixSkip[]
  output: string
  changed: boolean
  replaced: number
}

type Region = readonly [start: number, end: number]
type Context = 'template' | 'setup' | 'plain'

interface AttrRange {
  start: number
  end: number
  /** 属性值外层引号；无引号属性为 undefined */
  quote: string | undefined
}

interface FileShape {
  template?: Region
  setup?: Region
  script?: Region
  /** 模板里所有属性值 / 指令表达式的范围，用来判断字面量外层的引号 */
  attrRanges: AttrRange[]
}

const USE_I18N_IMPORT = "import { useI18n } from 'vue-i18n'"
const USE_I18N_CONST = 'const { t } = useI18n()'

function toRegion(loc: { start: { offset: number }; end: { offset: number } }): Region {
  return [loc.start.offset, loc.end.offset]
}

function inRegion(offset: number, region: Region | undefined): boolean {
  return region !== undefined && offset >= region[0] && offset < region[1]
}

function collectAttrRanges(children: TemplateChildNode[], source: string, out: AttrRange[]): void {
  for (const child of children) {
    if (child.type !== NodeTypes.ELEMENT) continue
    const el: ElementNode = child
    for (const prop of el.props) {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        if (!prop.value) continue
        const start = prop.value.loc.start.offset
        const first = source[start]
        out.push({
          start,
          end: prop.value.loc.end.offset,
          quote: first === '"' || first === "'" ? first : undefined,
        })
      } else if (prop.exp && prop.exp.type === NodeTypes.SIMPLE_EXPRESSION) {
        const start = prop.exp.loc.start.offset
        const before = source[start - 1]
        out.push({
          start,
          end: prop.exp.loc.end.offset,
          quote: before === '"' || before === "'" ? before : undefined,
        })
      }
    }
    collectAttrRanges(el.children, source, out)
  }
}

function shapeOf(source: string, ctx: FileContext): FileShape {
  const shape: FileShape = { attrRanges: [] }
  if (!/\.vue$/i.test(ctx.relativePath)) return shape
  const { descriptor } = parseSfc(source, { filename: ctx.relativePath, sourceMap: false })
  if (descriptor.template) {
    shape.template = toRegion(descriptor.template.loc)
    const ast: RootNode | undefined = descriptor.template.ast
    if (ast) collectAttrRanges(ast.children, source, shape.attrRanges)
  }
  if (descriptor.scriptSetup) shape.setup = toRegion(descriptor.scriptSetup.loc)
  if (descriptor.script) shape.script = toRegion(descriptor.script.loc)
  return shape
}

function contextOf(offset: number, shape: FileShape): Context {
  if (inRegion(offset, shape.template)) return 'template'
  if (inRegion(offset, shape.setup)) return 'setup'
  return 'plain'
}

function prevNonSpace(source: string, from: number): number {
  let i = from
  while (i >= 0 && /\s/.test(source[i] ?? '')) i--
  return i
}

function nextNonSpace(source: string, from: number): number {
  let i = from
  while (i < source.length && /\s/.test(source[i] ?? '')) i++
  return i
}

/** `<script setup>` 里 `t` 是否可用：yes / no（有 useI18n 但没解构 t）/ absent（完全没有 useI18n） */
function setupHasT(block: string): 'yes' | 'no' | 'absent' {
  if (!/useI18n\s*\(/.test(block)) return 'absent'
  const destructured = /const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*useI18n\s*\(/.test(block)
  const imported = /\bimport\s*\{[^}]*\bt\b[^}]*\}\s*from/.test(block)
  return destructured || imported ? 'yes' : 'no'
}

/** 在 setup 块里找 useI18n 的插入点：最后一个 import 之后；没有 import 则块内容起点 */
function useI18nInsertion(source: string, setup: Region): TextEdit {
  const [start, end] = setup
  const block = source.slice(start, end)
  const sf = ts.createSourceFile('setup.ts', block, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS)
  let lastImportEnd = -1
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) lastImportEnd = statement.getEnd()
  }
  if (lastImportEnd === -1) {
    return { start, end: start, text: `\n${USE_I18N_IMPORT}\n\n${USE_I18N_CONST}\n` }
  }
  const at = start + lastImportEnd
  return { start: at, end: at, text: `\n${USE_I18N_IMPORT}\n\n${USE_I18N_CONST}` }
}

/**
 * 为一个文件的分类结果规划 `--fix`：只处理 A 类，产出互不重叠的文本编辑与新增 key。
 * 纯函数：不读写文件，`output` 是应用编辑后的新源码。
 */
export function planFixes(
  source: string,
  ctx: FileContext,
  results: readonly TriageResult[],
  options: FixOptions = {},
): FixPlan {
  const keyStyle = options.keyStyle ?? 'text'
  const templateFn = options.templateFn ?? '$t'
  const scriptFn = options.scriptFn ?? 't'
  const fixPlainScripts = options.fixPlainScripts ?? false
  const ensureUseI18n = options.ensureUseI18n ?? true
  const includeUnsure = options.includeUnsure ?? false
  const existing = options.existingKeys

  const shape = shapeOf(source, ctx)
  const edits: TextEdit[] = []
  const keys = new Map<string, string>()
  const skipped: FixSkip[] = []
  let replaced = 0
  let usedSetupT = false

  const setupBlock = shape.setup ? source.slice(shape.setup[0], shape.setup[1]) : ''
  const setupT = shape.setup ? setupHasT(setupBlock) : 'absent'

  /** 属性上下文里 key 不能含任何引号（不依赖属性值里的转义），否则退回 hash */
  const keyFor = (text: string, inAttribute: boolean): string => {
    let key = makeKey(text, keyStyle, existing)
    if (inAttribute && /['"]/.test(key)) key = hashKey(text)
    return key
  }
  const remember = (key: string, text: string): void => {
    if (!existing?.has(key)) keys.set(key, text)
  }
  const skip = (node: StringNode, reason: FixSkipReason): void => {
    skipped.push({ node, reason })
  }

  for (const r of results) {
    if (r.category !== 'A_UI_TEXT') continue
    const node = r.node
    const start = node.loc.offset
    const end = node.loc.endOffset
    if (end === undefined) {
      skip(node, 'missing-range')
      continue
    }
    if (r.matchedBy === 'fallback' && !includeUnsure) {
      skip(node, 'unsure')
      continue
    }

    const context = contextOf(start, shape)
    const raw = source.slice(start, end)
    const templateKind = node.kind === 'template-text' || node.kind === 'template-attr'

    if (templateKind && context !== 'template') {
      skip(node, 'jsx')
      continue
    }

    // ---- 模板文本节点 ----
    if (node.kind === 'template-text') {
      const key = keyFor(node.value, false)
      edits.push({ start, end, text: `{{ ${templateFn}(${quoteJs(key)}) }}` })
      remember(key, node.value)
      replaced++
      continue
    }

    // ---- 模板字符串静态段：改了会破坏语序，交给人 ----
    if (raw.startsWith('}') || raw.endsWith('${')) {
      skip(node, 'template-literal')
      continue
    }

    // ---- 静态属性 placeholder="x" → :placeholder="$t('x')" ----
    if (node.kind === 'template-attr') {
      const eq = prevNonSpace(source, start - 1)
      if (source[eq] === '=') {
        const attrName = node.attrName ?? ''
        const nameEnd = prevNonSpace(source, eq - 1) + 1
        const nameStart = nameEnd - attrName.length
        const outer = raw[0]
        if (
          attrName.length === 0 ||
          source.slice(nameStart, nameEnd) !== attrName ||
          (outer !== '"' && outer !== "'")
        ) {
          skip(node, 'unsupported')
          continue
        }
        const inner = outer === '"' ? "'" : '"'
        const key = keyFor(node.value, true)
        edits.push({
          start: nameStart,
          end,
          text: `:${attrName}=${outer}${templateFn}(${quoteJs(key, inner)})${outer}`,
        })
        remember(key, node.value)
        replaced++
        continue
      }
      // 否则是 `:attr="'x'"` 这种绑定里的整段字面量，按表达式字面量处理
    }

    // ---- 表达式 / 脚本里的字符串字面量 ----
    const before = source[prevNonSpace(source, start - 1)]
    const after = source[nextNonSpace(source, end)]
    if (before === '+' || after === '+') {
      skip(node, 'concatenation')
      continue
    }

    let fn: string
    if (context === 'template') {
      fn = templateFn
    } else if (context === 'setup') {
      fn = scriptFn
      if (scriptFn === 't') {
        if (setupT === 'no') {
          skip(node, 'no-t-in-scope')
          continue
        }
        if (setupT === 'absent' && !ensureUseI18n) {
          skip(node, 'no-t-in-scope')
          continue
        }
        usedSetupT = true
      }
    } else {
      if (!fixPlainScripts) {
        skip(node, 'no-t-in-scope')
        continue
      }
      fn = scriptFn
    }

    const inAttribute =
      context === 'template' &&
      shape.attrRanges.some((range) => start >= range.start && end <= range.end)
    const literalQuote = raw[0] === '"' ? '"' : "'"
    const key = keyFor(node.value, inAttribute)
    edits.push({ start, end, text: `${fn}(${quoteJs(key, literalQuote)})` })
    remember(key, node.value)
    replaced++
  }

  if (usedSetupT && setupT === 'absent' && shape.setup) {
    edits.push(useI18nInsertion(source, shape.setup))
  }

  const output = edits.length > 0 ? applyEdits(source, edits) : source
  return {
    file: ctx.relativePath,
    edits,
    keys,
    skipped,
    output,
    changed: edits.length > 0,
    replaced,
  }
}
