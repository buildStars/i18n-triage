export interface LinePosition {
  /** 1-based */
  line: number
  /** 1-based，按 UTF-16 code unit 计数（与 Vue compiler 一致） */
  column: number
}

export interface LineIndex {
  /** 把整文件 0-based offset 反查成 1-based 行列 */
  locate(offset: number): LinePosition
}

/**
 * 为一段源码建立行首偏移表。只按 `\n` 分行，`\r` 视为普通字符，
 * 这样 CRLF 文件的列号与 Vue / TypeScript 的计数方式保持一致。
 */
export function createLineIndex(source: string): LineIndex {
  const lineStarts: number[] = [0]
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10 /* \n */) lineStarts.push(i + 1)
  }

  return {
    locate(offset: number): LinePosition {
      // 二分找最后一个 lineStarts[i] <= offset
      let lo = 0
      let hi = lineStarts.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if ((lineStarts[mid] ?? 0) <= offset) lo = mid
        else hi = mid - 1
      }
      const lineStart = lineStarts[lo] ?? 0
      return { line: lo + 1, column: offset - lineStart + 1 }
    },
  }
}
