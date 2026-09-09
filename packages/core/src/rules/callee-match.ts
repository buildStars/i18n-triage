/**
 * 被调用者点号全名与模式列表的匹配。
 *
 * - `showToast` / `ElMessageBox.confirm`：精确匹配整个名字
 * - `console.*`：某个**非末尾**段等于 `console`（`console.log`、`window.console.error`；`console` 本身不算）
 * - `*.t`：**末尾**段等于 `t`，且前面至少有一个接收者段（`i18n.t`；裸 `t` 不算，需另列 `t`）
 *
 * 解析器把动态成员访问记为 `X[]`（`notification[type](...)`），这里视同 `X.<动态>`，
 * 因此 `notification.*` 能命中它，而精确的 `notification` 不能。
 */
export function matchesCallee(calleeName: string, patterns: readonly string[]): boolean {
  const segments = calleeName
    .split('.')
    .flatMap((segment) => (segment.endsWith('[]') ? [segment.slice(0, -2), '[]'] : [segment]))
  const normalized = segments.join('.')
  return patterns.some((pattern) => matchOne(normalized, segments, pattern))
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

/**
 * 属性名（模板属性或对象属性）与模式列表的匹配，匹配前先做 kebab-case 归一化。
 *
 * - `placeholder`：精确
 * - `*-text`：以 `-text` 结尾（`active-text`、`element-loading-text`、`startPlaceholder` → `start-placeholder`）
 * - `data-*`：以 `data-` 开头
 */
export function matchesAttrName(attrName: string, patterns: readonly string[]): boolean {
  const name = toKebabCase(attrName)
  return patterns.some((raw) => {
    const pattern = toKebabCase(raw)
    if (pattern.startsWith('*')) return name.endsWith(pattern.slice(1)) && name !== pattern.slice(1)
    if (pattern.endsWith('*')) return name.startsWith(pattern.slice(0, -1))
    return name === pattern
  })
}
