import { describe, expect, it } from 'vitest'

import { applyEdits } from './edits'

describe('applyEdits', () => {
  it('returns the source unchanged when there are no edits', () => {
    expect(applyEdits('abc', [])).toBe('abc')
  })

  it('applies edits regardless of the order they are given in', () => {
    const src = '0123456789'
    const edits = [
      { start: 7, end: 9, text: 'X' },
      { start: 1, end: 3, text: 'YY' },
    ]
    expect(applyEdits(src, edits)).toBe('0YY3456X9')
    expect(applyEdits(src, [...edits].reverse())).toBe('0YY3456X9')
  })

  it('supports insertions (empty ranges) and adjacent edits', () => {
    const src = 'ab'
    expect(applyEdits(src, [{ start: 1, end: 1, text: '-' }])).toBe('a-b')
    expect(
      applyEdits(src, [
        { start: 0, end: 1, text: 'A' },
        { start: 1, end: 2, text: 'B' },
      ]),
    ).toBe('AB')
  })

  it('throws on overlapping edits instead of corrupting the file', () => {
    expect(() =>
      applyEdits('0123456789', [
        { start: 2, end: 6, text: 'x' },
        { start: 4, end: 8, text: 'y' },
      ]),
    ).toThrow(/overlap/i)
  })

  it('throws on out-of-range edits', () => {
    expect(() => applyEdits('abc', [{ start: 2, end: 5, text: 'x' }])).toThrow(/range/i)
  })
})
