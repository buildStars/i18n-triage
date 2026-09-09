/**
 * i18n key 的生成策略。
 *
 * - `text`（默认）：中文即 key。代码可读、语言包无损、不需要拼音库，是国内项目最常见的做法。
 *   但 vue-i18n 的消息语法把 `.` 当嵌套路径、`{}` 当插值、`|` 当复数、`@` 当链接、`$` 当修饰符，
 *   含这些字符（或过长 / 含换行）的文案退回 hash key。
 * - `hash`：`k_` + FNV-1a 32 位十六进制，稳定、短、无歧义，但代码里不可读。
 */

export type KeyStyle = 'text' | 'hash'

/** vue-i18n 消息语法里有特殊含义的字符 */
const SPECIAL_CHARS = /[.{}|@$]/
/** 超过这个长度的文案不适合直接当 key */
const MAX_TEXT_KEY_LENGTH = 40

export function needsHashFallback(text: string): boolean {
  return (
    SPECIAL_CHARS.test(text) ||
    text.length > MAX_TEXT_KEY_LENGTH ||
    /[\r\n]/.test(text) ||
    text !== text.trim()
  )
}

/** FNV-1a 32 位，与 SARIF 指纹同族但输入不同（只看文案） */
export function hashKey(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `k_${hash.toString(16).padStart(8, '0')}`
}

/** existing（key → 文案）的反查缓存：同一个 Map 大小不变就复用；调用方往里追加 key 后会自动重建 */
const reverseCache = new WeakMap<
  ReadonlyMap<string, string>,
  { size: number; reverse: Map<string, string> }
>()

function findExistingKey(text: string, existing: ReadonlyMap<string, string>): string | undefined {
  let cached = reverseCache.get(existing)
  if (!cached || cached.size !== existing.size) {
    const reverse = new Map<string, string>()
    for (const [key, value] of existing) if (!reverse.has(value)) reverse.set(value, key)
    cached = { size: existing.size, reverse }
    reverseCache.set(existing, cached)
  }
  return cached.reverse.get(text)
}

/**
 * 为一段文案生成 key。若 existing 里已经有 value 等于该文案的条目，直接复用那个 key，
 * 这样已有语言包的项目不会被塞进重复条目。
 */
export function makeKey(
  text: string,
  style: KeyStyle = 'text',
  existing?: ReadonlyMap<string, string>,
): string {
  if (existing) {
    const found = findExistingKey(text, existing)
    if (found !== undefined) return found
  }
  if (style === 'hash' || needsHashFallback(text)) return hashKey(text)
  return text
}

/** 生成 JS 字符串字面量（默认单引号），转义反斜杠、所用引号与换行 */
export function quoteJs(text: string, quote: "'" | '"' = "'"): string {
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(quote === "'" ? /'/g : /"/g, `\\${quote}`)
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  return `${quote}${escaped}${quote}`
}
