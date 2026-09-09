import { describe, expect, it } from 'vitest'

import { CHINESE_RE, containsChinese } from './chinese'

describe('containsChinese', () => {
  it('returns true for a string of CJK ideographs', () => {
    expect(containsChinese('暂无数据')).toBe(true)
  })

  it('returns true when Chinese is mixed with ASCII', () => {
    expect(containsChinese('订单 #123')).toBe(true)
  })

  it('returns false for pure ASCII', () => {
    expect(containsChinese('hello world')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(containsChinese('')).toBe(false)
  })

  it('returns false for full-width punctuation only', () => {
    expect(containsChinese('，。！？')).toBe(false)
  })

  it('detects CJK Unified Ideographs Extension A', () => {
    expect(containsChinese('㐀')).toBe(true)
  })
})

describe('CHINESE_RE', () => {
  it('is not a global regex, so test() is stateless', () => {
    expect(CHINESE_RE.global).toBe(false)
    expect(CHINESE_RE.test('中')).toBe(true)
    expect(CHINESE_RE.test('中')).toBe(true)
  })
})
