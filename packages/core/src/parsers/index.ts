// 解析器层：源码字符串 → StringNode[]
// - vue-sfc.ts       .vue：template（compiler-dom 原始 AST）+ script 块（遮罩后交给 script.ts）
// - expression.ts    模板表达式里的字符串字面量（TypeScript parser）
// - script.ts        .ts / .js / .tsx / .jsx（ts-morph），判定表见 docs/ts-morph-kinds.md
// - parse-source.ts  按后缀分派
// 全部为纯函数，入参是源码字符串而不是文件路径。

export { parseVueSfc, parseVueTemplate } from './vue-sfc'
export type { ParseScriptOptions, ScriptDialect } from './script'
export { inferDialect, parseScript } from './script'
export type { ExpressionLiteral } from './expression'
export { extractStringLiterals } from './expression'
export { parseSource } from './parse-source'
