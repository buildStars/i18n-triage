// 开发辅助脚本：列出一段 TS 源码里所有字符串类节点的 SyntaxKind、父链，用于制定 ts-morph → StringKind 判定表。
// 对照表见 docs/ts-morph-kinds.md。运行：node packages/core/scripts/dump-ts-ast.mjs
import { Node, Project, SyntaxKind, ts } from 'ts-morph'

const SAMPLE = `import { t } from './i18n'            // import 路径
import zh from '@/locales/中文路径'      // import 路径（中文）
export * from './导出路径'
const dyn = () => import('./动态导入')
const req = require('./require路径')
// 单行注释：已封盘
/* 块注释：加载失败 */
/**
 * JSDoc：请输入
 * @example showToast('示例')
 */
export const RE = /中文正则/g
type Status = '已封盘' | '未封盘'
interface Row { '中文键': string; label: string }
declare module '中文模块' {}
enum Color { Red = '红波', Blue = '蓝波', '中文成员' = 3 }
const dict = { label: '联盟', '联盟': 1, ['计算键']: 2, nested: { inner: '内层' }, tags: ['标签一', '标签二'], n: 1 }
const options = [{ label: '待支付', value: 0 }, { label: '已支付', value: 1 }, { label: '已取消', value: 2 }]
const idx = dict['联盟']
const opt = dict?.['计算键']
showToast('已封盘')
showToast(t('已翻译'))
showToast(ok ? '成功' : '失败')
showToast('共' + n + '条')
showToast(\`合计\${n}元\`)
showToast({ message: '对象参数', duration: 1 })
ElMessageBox.confirm({ title: '标题', buttons: { ok: '确定' } })
this.$message.success('保存成功')
console.error('加载失败', err)
logger.warn(\`警告\${x}\`)
new Error('构造参数')
foo()('二次调用')
(cond ? a : b)('三元被调用者')
list.map((x) => x.label + '元')
const v = '裸字面量'
if (status === '比较') {}
switch (s) { case '分支': break }
const tag = css\`color: red; /* 标签模板 */\`
function f(p = '默认参数') { return '返回值' }
class K { prop = '类属性' }
const jsx = <div title="属性" data-x={'表达式属性'}>文本节点 {'花括号文本'}</div>
`

const project = new Project({ useInMemoryFileSystem: true, skipLoadingLibFiles: true })
const sf = project.createSourceFile('sample.tsx', SAMPLE, { scriptKind: ts.ScriptKind.TSX })

const isStringy = (n) =>
  Node.isStringLiteral(n) ||
  Node.isNoSubstitutionTemplateLiteral(n) ||
  Node.isTemplateHead(n) ||
  Node.isTemplateMiddle(n) ||
  Node.isTemplateTail(n) ||
  Node.isJsxText(n)

const short = (n) => {
  const txt = n.getText().replace(/\s+/g, ' ')
  return `${n.getKindName()}${txt.length > 28 ? `(${txt.slice(0, 28)}…)` : `(${txt})`}`
}

console.log('kind'.padEnd(32), 'text'.padEnd(14), 'line', 'parent chain (nearest → statement)')
sf.forEachDescendant((node) => {
  if (!isStringy(node)) return
  const chain = []
  let p = node.getParent()
  while (p && !Node.isSourceFile(p) && chain.length < 5) {
    chain.push(short(p))
    if (Node.isStatement(p)) break
    p = p.getParent()
  }
  const text = Node.isJsxText(node)
    ? JSON.stringify(node.getText().trim())
    : JSON.stringify(node.getLiteralText())
  console.log(
    node.getKindName().padEnd(32),
    text.padEnd(14),
    String(node.getStartLineNumber()).padEnd(4),
    chain.join(' ← '),
  )
})

console.log('\n=== JSDoc 是否被 forEachDescendant 访问？ ===')
let jsdocSeen = 0
sf.forEachDescendant((n) => {
  if (n.getKind() === SyntaxKind.JSDoc || n.getKind() === SyntaxKind.JSDocTag) jsdocSeen++
})
console.log('JSDoc / JSDocTag nodes visited:', jsdocSeen)

console.log('\n=== 模板字符串结构 ===')
const tpl = sf.getDescendantsOfKind(SyntaxKind.TemplateExpression)[0]
console.log(
  'TemplateExpression children:',
  tpl.getChildren().map((c) => `${c.getKindName()}:${JSON.stringify(c.getText())}`),
)
console.log(
  'head literalText:',
  JSON.stringify(tpl.getHead().getLiteralText()),
  'spans:',
  tpl
    .getTemplateSpans()
    .map(
      (s) =>
        `${s.getLiteral().getKindName()}:${JSON.stringify(s.getLiteral().getLiteralText())}@${s.getLiteral().getStart()}`,
    ),
)

console.log('\n=== ts version ===', ts.version)
