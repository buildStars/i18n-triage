/**
 * 终端显示宽度：CJK / 全角字符占 2 个单元格，其余占 1。
 * 注意这不是「中文检测」（那个统一在 core 的 utils/chinese.ts），而是东亚宽字符的排版口径，
 * 覆盖日文、韩文与全角标点，用于对齐报告列。
 */
function isWide(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  )
}

export function charWidth(char: string): number {
  const codePoint = char.codePointAt(0)
  if (codePoint === undefined) return 0
  return isWide(codePoint) ? 2 : 1
}

export function displayWidth(text: string): number {
  let width = 0
  for (const char of text) width += charWidth(char)
  return width
}

/** 右侧补空格到指定显示宽度；已更宽则原样返回 */
export function padEndDisplay(text: string, width: number): string {
  const current = displayWidth(text)
  return current >= width ? text : text + ' '.repeat(width - current)
}

/** 超出显示宽度时截断并追加 `…`（省略号本身占 1 格，计入 maxWidth） */
export function truncateDisplay(text: string, maxWidth: number): string {
  if (displayWidth(text) <= maxWidth) return text
  const limit = maxWidth - 1
  let out = ''
  let width = 0
  for (const char of text) {
    const w = charWidth(char)
    if (width + w > limit) break
    out += char
    width += w
  }
  return `${out}…`
}
