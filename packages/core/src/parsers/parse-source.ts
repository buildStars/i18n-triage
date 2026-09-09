import type { FileContext, StringNode } from '../types'
import { parseScript } from './script'
import { parseVueSfc } from './vue-sfc'

/** 按 `ctx.relativePath` 后缀分派：`.vue` → 整个 SFC；其余 → script 解析器 */
export function parseSource(source: string, ctx: FileContext): StringNode[] {
  return /\.vue$/i.test(ctx.relativePath) ? parseVueSfc(source, ctx) : parseScript(source, ctx)
}
