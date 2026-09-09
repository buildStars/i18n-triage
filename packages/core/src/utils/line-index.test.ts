import { describe, expect, it } from 'vitest'

import { createLineIndex } from './line-index'

describe('createLineIndex', () => {
  it('maps offset 0 to line 1 column 1', () => {
    const index = createLineIndex('abc')
    expect(index.locate(0)).toEqual({ line: 1, column: 1 })
  })

  it('maps offsets within the first line to 1-based columns', () => {
    const index = createLineIndex('abc\ndef')
    expect(index.locate(2)).toEqual({ line: 1, column: 3 })
  })

  it('maps the first character after a newline to the next line, column 1', () => {
    const index = createLineIndex('abc\ndef')
    expect(index.locate(4)).toEqual({ line: 2, column: 1 })
  })

  it('handles several lines', () => {
    const src = 'line1\nline2\nline3\nline4'
    const index = createLineIndex(src)
    expect(index.locate(src.indexOf('line4'))).toEqual({ line: 4, column: 1 })
    expect(index.locate(src.indexOf('3'))).toEqual({ line: 3, column: 5 })
  })

  it('counts columns in UTF-16 code units, matching the Vue compiler', () => {
    const src = '你好\n世界 x'
    const index = createLineIndex(src)
    expect(index.locate(src.indexOf('x'))).toEqual({ line: 2, column: 4 })
  })

  it('treats \\r as an ordinary character so CRLF files keep Vue-compatible columns', () => {
    const src = 'ab\r\ncd'
    const index = createLineIndex(src)
    expect(index.locate(src.indexOf('c'))).toEqual({ line: 2, column: 1 })
    expect(index.locate(2)).toEqual({ line: 1, column: 3 })
  })

  it('maps the offset equal to the source length to just past the last line', () => {
    const src = 'ab\ncd'
    const index = createLineIndex(src)
    expect(index.locate(src.length)).toEqual({ line: 2, column: 3 })
  })
})
