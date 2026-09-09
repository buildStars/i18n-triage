import { describe, expect, it } from 'vitest'

import { hashKey, makeKey, needsHashFallback, quoteJs } from './keys'

describe('makeKey — text style（中文即 key）', () => {
  it('uses the text itself as the key', () => {
    expect(makeKey('暂无数据', 'text')).toBe('暂无数据')
    expect(makeKey('请输入订单号', 'text')).toBe('请输入订单号')
  })

  it('falls back to a hash when the text would be misread by vue-i18n message syntax', () => {
    for (const text of ['请稍候...', '共 {n} 条', '是|否', '联系 @客服', '价格 $1', '含.点']) {
      const key = makeKey(text, 'text')
      expect(key, text).toMatch(/^k_[0-9a-f]{8}$/)
      expect(needsHashFallback(text), text).toBe(true)
    }
    expect(needsHashFallback('暂无数据')).toBe(false)
  })

  it('falls back to a hash for very long texts', () => {
    const long = '这是一段非常长的文案'.repeat(10)
    expect(makeKey(long, 'text')).toMatch(/^k_[0-9a-f]{8}$/)
  })

  it('reuses an existing key whose value equals the text', () => {
    const existing = new Map([['common.empty', '暂无数据']])
    expect(makeKey('暂无数据', 'text', existing)).toBe('common.empty')
    expect(makeKey('别的', 'text', existing)).toBe('别的')
  })
})

describe('makeKey — hash style', () => {
  it('is deterministic and different per text', () => {
    expect(makeKey('暂无数据', 'hash')).toBe(hashKey('暂无数据'))
    expect(hashKey('暂无数据')).toMatch(/^k_[0-9a-f]{8}$/)
    expect(hashKey('暂无数据')).not.toBe(hashKey('暂无数据。'))
  })
})

describe('quoteJs', () => {
  it('wraps in single quotes and escapes backslashes and single quotes', () => {
    expect(quoteJs('暂无数据')).toBe(`'暂无数据'`)
    expect(quoteJs("他说'好'")).toBe(`'他说\\'好\\''`)
    expect(quoteJs('a\\b')).toBe(`'a\\\\b'`)
  })

  it('escapes newlines', () => {
    expect(quoteJs('第一行\n第二行')).toBe(`'第一行\\n第二行'`)
  })
})
