import { describe, expect, it } from 'vitest'

import type { FileContext, StringNode } from '../types'
import { parseScript } from './script'

const ctx: FileContext = { relativePath: 'src/utils/demo.ts' }

/** 只挑关心的字段，方便整体断言 */
function pick(nodes: StringNode[]) {
  return nodes.map((n) => {
    const out: Record<string, unknown> = { value: n.value, kind: n.kind }
    if (n.calleeName !== undefined) out.calleeName = n.calleeName
    if (n.attrName !== undefined) out.attrName = n.attrName
    if (n.siblingChineseCount !== undefined) out.siblingChineseCount = n.siblingChineseCount
    return out
  })
}

describe('parseScript — call-arg', () => {
  it('reports a bare function call argument with its callee name', () => {
    expect(pick(parseScript(`showToast('已封盘')`, ctx))).toEqual([
      { value: '已封盘', kind: 'call-arg', calleeName: 'showToast' },
    ])
  })

  it('reports the full dotted callee path for member calls', () => {
    const src = `console.error('加载失败', err)
this.$message.success('保存成功')
ElMessageBox.confirm('确认删除？')`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '加载失败', kind: 'call-arg', calleeName: 'console.error' },
      { value: '保存成功', kind: 'call-arg', calleeName: 'this.$message.success' },
      { value: '确认删除？', kind: 'call-arg', calleeName: 'ElMessageBox.confirm' },
    ])
  })

  it('uses the nearest call for nested calls: showToast(t(x)) belongs to t', () => {
    expect(pick(parseScript(`showToast(t('已封盘'))`, ctx))).toEqual([
      { value: '已封盘', kind: 'call-arg', calleeName: 't' },
    ])
  })

  it('treats conditional and concatenation operands inside arguments as call-arg', () => {
    const src = `showToast(ok ? '成功' : '失败')
showToast('共' + n + '条')`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '成功', kind: 'call-arg', calleeName: 'showToast' },
      { value: '失败', kind: 'call-arg', calleeName: 'showToast' },
      { value: '共', kind: 'call-arg', calleeName: 'showToast' },
      { value: '条', kind: 'call-arg', calleeName: 'showToast' },
    ])
  })

  it('reports each Chinese static chunk of a template literal argument', () => {
    expect(pick(parseScript('logger.warn(`警告${x}条，共${n}页`)', ctx))).toEqual([
      { value: '警告', kind: 'call-arg', calleeName: 'logger.warn' },
      { value: '条，共', kind: 'call-arg', calleeName: 'logger.warn' },
      { value: '页', kind: 'call-arg', calleeName: 'logger.warn' },
    ])
  })

  it('handles new expressions, chained calls, element-access callees and tagged templates', () => {
    const src = `new Error('构造参数');
foo()('二次调用');
api.list['fetch']('元素访问');
(a as any).b!('断言');
css\`标签模板\``
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '构造参数', kind: 'call-arg', calleeName: 'Error' },
      { value: '二次调用', kind: 'call-arg', calleeName: 'foo()' },
      { value: '元素访问', kind: 'call-arg', calleeName: 'api.list.fetch' },
      { value: '断言', kind: 'call-arg', calleeName: 'a.b' },
      { value: '标签模板', kind: 'call-arg', calleeName: 'css' },
    ])
  })

  it('leaves calleeName undefined when the callee cannot be named', () => {
    const [node] = parseScript(`(cond ? a : b)('三元被调用者')`, ctx)
    expect(node).toMatchObject({ value: '三元被调用者', kind: 'call-arg' })
    expect(node?.calleeName).toBeUndefined()
  })

  it('does not attribute strings inside a callback body to the outer call', () => {
    const [node] = parseScript(`list.map((x) => x.label + '元')`, ctx)
    expect(node).toMatchObject({ value: '元', kind: 'literal' })
    expect(node?.calleeName).toBeUndefined()
  })
})

describe('parseScript — object-value', () => {
  it('reports property values and counts Chinese values in the same object', () => {
    const src = `const dict = { label: '联盟', desc: '描述', n: 1, en: 'league' }`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '联盟', kind: 'object-value', siblingChineseCount: 2 },
      { value: '描述', kind: 'object-value', siblingChineseCount: 2 },
    ])
  })

  it('counts only the same level, not nested objects', () => {
    const src = `const o = { a: '一', nested: { b: '二', c: '三' } }`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '一', kind: 'object-value', siblingChineseCount: 1 },
      { value: '二', kind: 'object-value', siblingChineseCount: 2 },
      { value: '三', kind: 'object-value', siblingChineseCount: 2 },
    ])
  })

  it('counts across sibling objects when the object is an array element (options lists)', () => {
    const src = `const options = [
  { label: '待支付', value: 0 },
  { label: '已支付', value: 1 },
  { label: '已取消', value: 2 },
]`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '待支付', kind: 'object-value', siblingChineseCount: 3 },
      { value: '已支付', kind: 'object-value', siblingChineseCount: 3 },
      { value: '已取消', kind: 'object-value', siblingChineseCount: 3 },
    ])
  })

  it('treats string elements of an array property as object-value and counts them', () => {
    const src = `const o = { tags: ['标签一', '标签二'], name: '名' }`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '标签一', kind: 'object-value', siblingChineseCount: 3 },
      { value: '标签二', kind: 'object-value', siblingChineseCount: 3 },
      { value: '名', kind: 'object-value', siblingChineseCount: 3 },
    ])
  })

  it('attaches the enclosing call as calleeName for object-style UI API calls', () => {
    const src = `showToast({ message: '对象参数', duration: 1 })
ElMessageBox.confirm({ title: '标题', buttons: { ok: '确定' } })`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '对象参数', kind: 'object-value', calleeName: 'showToast', siblingChineseCount: 1 },
      {
        value: '标题',
        kind: 'object-value',
        calleeName: 'ElMessageBox.confirm',
        siblingChineseCount: 1,
      },
      {
        value: '确定',
        kind: 'object-value',
        calleeName: 'ElMessageBox.confirm',
        siblingChineseCount: 1,
      },
    ])
  })

  it('reports template literal chunks used as property values', () => {
    expect(pick(parseScript('const o = { label: `第${n}期` }', ctx))).toEqual([
      { value: '第', kind: 'object-value', siblingChineseCount: 1 },
      { value: '期', kind: 'object-value', siblingChineseCount: 1 },
    ])
  })
})

describe('parseScript — object-key', () => {
  it('reports quoted keys and computed string keys', () => {
    const src = `const m = { '联盟': 1, ['计算键']: 2, plain: 3 }`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '联盟', kind: 'object-key' },
      { value: '计算键', kind: 'object-key' },
    ])
  })

  it('tells a Chinese key from a Chinese value in the same property', () => {
    expect(pick(parseScript(`const m = { '键': '值' }`, ctx))).toEqual([
      { value: '键', kind: 'object-key' },
      { value: '值', kind: 'object-value', siblingChineseCount: 1 },
    ])
  })

  it('reports strings used as map indexes as object-key', () => {
    const src = `const a = dict['联盟']
const b = dict?.['计算键']`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '联盟', kind: 'object-key' },
      { value: '计算键', kind: 'object-key' },
    ])
  })
})

describe('parseScript — enum-member', () => {
  it('reports enum member string initializers', () => {
    expect(pick(parseScript(`enum Color { Red = '红波', Blue = '蓝波', None = 0 }`, ctx))).toEqual([
      { value: '红波', kind: 'enum-member' },
      { value: '蓝波', kind: 'enum-member' },
    ])
  })

  it('reports Chinese enum member names', () => {
    expect(pick(parseScript(`enum E { '中文成员' = 3 }`, ctx))).toEqual([
      { value: '中文成员', kind: 'enum-member' },
    ])
  })
})

describe('parseScript — literal', () => {
  it('reports variable initializers, returns and default parameters as literal', () => {
    const src = `const v = '裸字面量'
function f(p = '默认参数') { return '返回值' }
class K { prop = '类属性' }`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '裸字面量', kind: 'literal' },
      { value: '默认参数', kind: 'literal' },
      { value: '返回值', kind: 'literal' },
      { value: '类属性', kind: 'literal' },
    ])
  })

  it('reports comparison operands, case labels and bare array elements as literal', () => {
    const src = `if (status === '比较') {}
switch (s) { case '分支': break }
const arr = ['甲', '乙']`
    expect(pick(parseScript(src, ctx))).toEqual([
      { value: '比较', kind: 'literal' },
      { value: '分支', kind: 'literal' },
      { value: '甲', kind: 'literal' },
      { value: '乙', kind: 'literal' },
    ])
  })
})

describe('parseScript — JSX (tsx / jsx)', () => {
  const tsx: FileContext = { relativePath: 'src/App.tsx' }

  it('reports JSX text as template-text and JSX attributes as template-attr', () => {
    const src = `const el = <div title="属性" data-x={'表达式属性'} className="wrap">文本节点 {'花括号文本'}</div>`
    expect(pick(parseScript(src, tsx))).toEqual([
      { value: '属性', kind: 'template-attr', attrName: 'title' },
      { value: '表达式属性', kind: 'template-attr', attrName: 'data-x' },
      { value: '文本节点', kind: 'template-text' },
      { value: '花括号文本', kind: 'literal' },
    ])
  })

  it('parses .jsx files with JSX enabled by default', () => {
    const jsx: FileContext = { relativePath: 'src/App.jsx' }
    expect(pick(parseScript(`export const A = () => <p>你好</p>`, jsx))).toEqual([
      { value: '你好', kind: 'template-text' },
    ])
  })
})

describe('parseScript — 必须完全忽略的内容', () => {
  it('ignores Chinese inside line, block and JSDoc comments', () => {
    const src = `// 单行注释：已封盘
/* 块注释：加载失败 */
/**
 * JSDoc：请输入
 * @example showToast('示例')
 */
export const ok = true`
    expect(parseScript(src, ctx)).toEqual([])
  })

  it('ignores import / export paths, dynamic import and require', () => {
    const src = `import zh from '@/locales/中文路径'
import type { T } from './类型路径'
export * from './导出路径'
export { x } from './再导出'
const dyn = () => import('./动态导入')
const req = require('./require路径')`
    expect(parseScript(src, ctx)).toEqual([])
  })

  it('ignores regular expression literals', () => {
    expect(parseScript(`const re = /中文正则/g; const re2 = new RegExp(/再来一个/)`, ctx)).toEqual(
      [],
    )
  })

  it('ignores string literal types, interface member names and module declarations', () => {
    const src = `type Status = '已封盘' | '未封盘'
interface Row { '中文键': string; label: Record<'键', number> }
declare module '中文模块' {}
let x: '字面量类型'`
    expect(parseScript(src, ctx)).toEqual([])
  })

  it('ignores strings without Chinese', () => {
    expect(parseScript(`showToast('ok'); const a = { b: 'c' }`, ctx)).toEqual([])
  })
})

describe('parseScript — 位置信息', () => {
  const src = [
    `import { t } from './i18n'`, // 1
    ``, // 2
    `export function save() {`, // 3
    `  showToast('保存成功')`, // 4   引号在第 13 列
    `  const dict = { label: '联盟' }`, // 5   引号在第 25 列
    '  logger.warn(`警告${x}条`)', // 6   反引号在第 15 列，`}` 在第 21 列
    `}`, // 7
  ].join('\n')
  const nodes = parseScript(src, ctx)
  const byValue = (v: string) => {
    const n = nodes.find((x) => x.value === v)
    if (!n) throw new Error(`missing node ${v}`)
    return n
  }

  it('fills loc.file from the context and points offsets at the opening quote', () => {
    const n = byValue('保存成功')
    expect(n.loc.file).toBe('src/utils/demo.ts')
    expect(n.loc.offset).toBe(src.indexOf(`'保存成功'`))
    expect(n.loc).toMatchObject({ line: 4, column: 13 })
  })

  it('locates object values', () => {
    const n = byValue('联盟')
    expect(n.loc.offset).toBe(src.indexOf(`'联盟'`))
    expect(n.loc).toMatchObject({ line: 5, column: 25 })
  })

  it('locates template head at the backtick and template tail at the closing brace', () => {
    const head = byValue('警告')
    const tail = byValue('条')
    expect(head.loc.offset).toBe(src.indexOf('`警告'))
    expect(head.loc).toMatchObject({ line: 6, column: 15 })
    expect(tail.loc.offset).toBe(src.indexOf('}条'))
    expect(tail.loc).toMatchObject({ line: 6, column: 21 })
  })

  it('keeps Vue-compatible columns in CRLF sources', () => {
    const crlf = `const a = 1\r\nshowToast('第二行')`
    const [n] = parseScript(crlf, ctx)
    expect(n?.loc).toMatchObject({ line: 2, column: 11, offset: crlf.indexOf(`'第二行'`) })
  })
})
