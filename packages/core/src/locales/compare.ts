export interface LocaleDiff {
  locale: string
  /** 源语言的 key 总数 */
  sourceKeys: number
  /** 目标里存在且非空的源 key 数 */
  translated: number
  /** 源里有、目标里没有（按源顺序） */
  missing: string[]
  /** 目标里有、源里没有 */
  extra: string[]
  /** 目标里有但值为空 / 仅空白 */
  empty: string[]
}

/** 以 source 为基准对比一个目标语言包 */
export function compareLocales(
  source: ReadonlyMap<string, string>,
  target: ReadonlyMap<string, string>,
  locale: string,
): LocaleDiff {
  const missing: string[] = []
  const empty: string[] = []
  let translated = 0
  for (const key of source.keys()) {
    const value = target.get(key)
    if (value === undefined) missing.push(key)
    else if (value.trim() === '') empty.push(key)
    else translated++
  }
  const extra = [...target.keys()].filter((key) => !source.has(key))
  return { locale, sourceKeys: source.size, translated, missing, extra, empty }
}
