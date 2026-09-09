import type { LocaleDiff } from './compare'
import { compareLocales } from './compare'
import type { DynamicUsage, KeyUsage, KeyUsages } from './usages'

export interface LocaleAuditInput {
  sourceLocale: string
  /** 源语言：key → 文案 */
  source: ReadonlyMap<string, string>
  /** 其他语言：locale → (key → 文案) */
  targets: ReadonlyMap<string, ReadonlyMap<string, string>>
  /** 所有代码文件的引用合并 */
  usages: KeyUsages
}

export interface LocaleAudit {
  sourceLocale: string
  sourceKeys: number
  /** 每个目标语言的完整度 */
  diffs: LocaleDiff[]
  /** 源里定义、代码里既无静态引用也不匹配任何动态前缀的 key */
  dead: string[]
  /** 没有静态引用，但匹配某个动态调用前缀的 key */
  maybeUsed: { key: string; prefix: string }[]
  /** 没有静态引用，但代码里有一个字符串字面量恰好等于它（路由 meta.title、菜单配置之类先存后 t() 的用法） */
  referencedAsLiteral: string[]
  /** 代码引用了、源语言里却没有的 key（保留每处位置） */
  undefined: KeyUsage[]
  /** 源里被静态引用到的 key 数 */
  usedKeys: number
  dynamic: DynamicUsage[]
  /** 没有静态前缀的动态调用数：这类调用让死 key 判定不可靠，报告里要提示 */
  dynamicWithoutPrefix: number
}

export function auditLocales(input: LocaleAuditInput): LocaleAudit {
  const { source, targets, usages } = input
  const used = new Set(usages.static.map((u) => u.key))
  const prefixes = [...new Set(usages.dynamic.map((d) => d.prefix).filter((p): p is string => !!p))]

  const literals = new Set(usages.literals)

  const dead: string[] = []
  const maybeUsed: { key: string; prefix: string }[] = []
  const referencedAsLiteral: string[] = []
  let usedKeys = 0
  for (const key of source.keys()) {
    if (used.has(key)) {
      usedKeys++
      continue
    }
    const prefix = prefixes.find((p) => key.startsWith(p))
    if (prefix !== undefined) maybeUsed.push({ key, prefix })
    else if (literals.has(key)) referencedAsLiteral.push(key)
    else dead.push(key)
  }

  const undefinedUsages = usages.static.filter((u) => !source.has(u.key))

  return {
    sourceLocale: input.sourceLocale,
    sourceKeys: source.size,
    diffs: [...targets.entries()].map(([locale, target]) => compareLocales(source, target, locale)),
    dead,
    maybeUsed,
    referencedAsLiteral,
    undefined: undefinedUsages,
    usedKeys,
    dynamic: usages.dynamic,
    dynamicWithoutPrefix: usages.dynamic.filter((d) => d.prefix === undefined).length,
  }
}
