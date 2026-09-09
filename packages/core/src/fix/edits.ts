/** 一处文本替换：把 [start, end) 换成 text；start === end 即插入 */
export interface TextEdit {
  start: number
  end: number
  text: string
}

/**
 * 把一组互不重叠的编辑应用到源码上。编辑顺序无关；重叠或越界直接抛错，绝不产出被破坏的文件。
 */
export function applyEdits(source: string, edits: readonly TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end)

  let previousEnd = -1
  for (const edit of sorted) {
    if (edit.start < 0 || edit.end > source.length || edit.start > edit.end) {
      throw new Error(
        `edit out of range: [${edit.start}, ${edit.end}) on a source of length ${source.length}`,
      )
    }
    if (edit.start < previousEnd) {
      throw new Error(
        `overlapping edits at offset ${edit.start} (previous edit ended at ${previousEnd})`,
      )
    }
    previousEnd = edit.end
  }

  let out = ''
  let cursor = 0
  for (const edit of sorted) {
    out += source.slice(cursor, edit.start) + edit.text
    cursor = edit.end
  }
  return out + source.slice(cursor)
}
