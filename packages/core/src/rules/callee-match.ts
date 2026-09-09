/**
 * 被调用者点号全名与模式列表的匹配。
 *
 * - `showToast` / `ElMessageBox.confirm`：精确匹配整个名字
 * - `console.*`：某个**非末尾**段等于 `console`（`console.log`、`window.console.error`；`console` 本身不算）
 * - `*.t`：**末尾**段等于 `t`，且前面至少有一个接收者段（`i18n.t`；裸 `t` 不算，需另列 `t`）
 */
export function matchesCallee(calleeName: string, patterns: readonly string[]): boolean {
  const segments = calleeName.split('.')
  return patterns.some((pattern) => matchOne(calleeName, segments, pattern))
}

function matchOne(full: string, segments: readonly string[], pattern: string): boolean {
  if (pattern.endsWith('.*')) {
    const name = pattern.slice(0, -2)
    return segments.slice(0, -1).includes(name)
  }
  if (pattern.startsWith('*.')) {
    const name = pattern.slice(2)
    return segments.length >= 2 && segments[segments.length - 1] === name
  }
  return full === pattern
}

/** `confirmButtonText` → `confirm-button-text`；已是 kebab-case 的原样返回（统一小写） */
export function toKebabCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}
