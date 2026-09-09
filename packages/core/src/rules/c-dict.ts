import { DEFAULT_DICT_DIRS, DEFAULT_DICT_SIBLING_THRESHOLD } from './defaults'
import type { NamedRule } from './named-rule'
import { defineRule } from './named-rule'

export interface DictOptions {
  /** 字典目录名列表；同名文件（constants.ts）也算 */
  dictDirs: readonly string[]
  /** 同一对象（或 options 数组）里含中文 value 的最低个数 */
  siblingThreshold: number
}

/**
 * 路径是否位于字典目录下（任意层级，`/` 或 `\` 分隔，忽略大小写），
 * 或文件名本身就是字典名（`src/constants.ts`、`utils/enums.js`）。
 */
export function isInDictPath(
  relativePath: string,
  dictDirs: readonly string[] = DEFAULT_DICT_DIRS,
): boolean {
  const dirs = new Set(dictDirs.map((d) => d.replace(/[\\/]+$/, '').toLowerCase()))
  const segments = relativePath.split(/[\\/]+/).filter((s) => s.length > 0)
  const file = segments.pop() ?? ''
  if (segments.some((s) => dirs.has(s.toLowerCase()))) return true
  const stem = file.replace(/\.[^.]+$/, '').toLowerCase()
  return dirs.has(stem)
}

/**
 * C 数据字典。三个条件全部满足：
 * 1. 文件位于字典目录（constants/ enum/ enums/ dict/ …）
 * 2. kind 是 object-value
 * 3. 同一对象（options 数组按整个数组算）里含中文的 value ≥ 阈值
 */
export function createDictRule(options: Partial<DictOptions> = {}): NamedRule {
  const dirs = options.dictDirs ?? DEFAULT_DICT_DIRS
  const threshold = options.siblingThreshold ?? DEFAULT_DICT_SIBLING_THRESHOLD

  return defineRule('c-dict', (node, ctx) => {
    if (node.kind !== 'object-value') return null
    if ((node.siblingChineseCount ?? 0) < threshold) return null
    return isInDictPath(ctx.relativePath, dirs) ? 'C_DICT' : null
  })
}

export const cDictRule: NamedRule = createDictRule()
