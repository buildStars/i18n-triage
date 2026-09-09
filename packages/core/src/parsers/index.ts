// 解析器层：源码字符串 → StringNode[]
// - vue-sfc.ts     .vue 的 <template> 块（@vue/compiler-sfc 拆块，遍历 compiler-dom 原始 AST）
// - expression.ts  模板表达式里的字符串字面量（TypeScript parser）
// - script.ts      .ts / .js 以及 .vue 的 <script> 块（ts-morph）
// 全部为纯函数，入参是源码字符串而不是文件路径。

export { parseVueTemplate } from './vue-sfc'
export type { ExpressionLiteral } from './expression'
export { extractStringLiterals } from './expression'
