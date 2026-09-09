/**
 * 把语言包对象压平成 `a.b.c` → 文案 的 Map。
 * - 嵌套对象用 `.` 连接（vue-i18n 的 key 路径口径）
 * - 数组按下标：`list.0`
 * - 只保留字符串叶子，数字 / 布尔 / null 忽略
 * - 顶层 key 本身含 `.`（中文即 key 的项目）原样保留
 */
export function flattenMessages(value: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') {
      if (path) out.set(path, node)
      return
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i)))
      return
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, path ? `${path}.${k}` : k)
      }
    }
  }
  walk(value, prefix)
  return out
}
