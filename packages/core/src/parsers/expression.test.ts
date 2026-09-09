import { describe, expect, it } from 'vitest'

import { extractStringLiterals } from './expression'

describe('extractStringLiterals', () => {
  it('returns string literals in a conditional expression with their offsets', () => {
    const expr = "ok ? '成功' : '失败'"
    const ok = expr.indexOf("'成功'")
    const fail = expr.indexOf("'失败'")
    expect(extractStringLiterals(expr)).toEqual([
      { value: '成功', start: ok, end: ok + 4 },
      { value: '失败', start: fail, end: fail + 4 },
    ])
  })

  it('returns the unescaped value for double-quoted strings', () => {
    expect(extractStringLiterals('fn("a\\"b")')).toEqual([{ value: 'a"b', start: 3, end: 9 }])
  })

  it('returns a no-substitution template literal', () => {
    const expr = 'fn(`暂无数据`)'
    expect(extractStringLiterals(expr)).toEqual([{ value: '暂无数据', start: 3, end: 9 }])
  })

  it('returns each static chunk of a template literal with substitutions', () => {
    const expr = '`共${n}条，${m}页`'
    const middle = expr.indexOf('}条')
    const tail = expr.lastIndexOf('}')
    expect(extractStringLiterals(expr)).toEqual([
      { value: '共', start: 0, end: 4 },
      { value: '条，', start: middle, end: middle + 5 },
      { value: '页', start: tail, end: expr.length },
    ])
  })

  it('skips empty template chunks', () => {
    expect(extractStringLiterals('`${a}${b}`')).toEqual([])
  })

  it('returns an empty array when there are no string literals', () => {
    expect(extractStringLiterals('item.name + count')).toEqual([])
  })

  it('does not treat comments inside the expression as strings', () => {
    expect(extractStringLiterals("a /* '注释' */ + b")).toEqual([])
  })

  it('handles inline statements as used by v-on handlers', () => {
    const expr = "count++; go('去哪')"
    const start = expr.indexOf("'去哪'")
    expect(extractStringLiterals(expr)).toEqual([{ value: '去哪', start, end: start + 4 }])
  })

  it('returns nothing for a v-for style expression', () => {
    expect(extractStringLiterals('(item, i) in list')).toEqual([])
  })
})
