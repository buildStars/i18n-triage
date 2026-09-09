import { describe, expect, it } from 'vitest'

import { compareLocales } from './compare'

const source = new Map([
  ['common.ok', '确定'],
  ['common.cancel', '取消'],
  ['hello', '你好'],
])

describe('compareLocales', () => {
  it('reports keys missing from the target, extra in the target, and empty values', () => {
    const target = new Map([
      ['common.ok', 'OK'],
      ['common.cancel', ''],
      ['onlyInEn', 'extra'],
    ])
    expect(compareLocales(source, target, 'en-US')).toEqual({
      locale: 'en-US',
      sourceKeys: 3,
      translated: 1,
      missing: ['hello'],
      extra: ['onlyInEn'],
      empty: ['common.cancel'],
    })
  })

  it('treats whitespace-only values as empty', () => {
    const target = new Map([
      ['common.ok', '  '],
      ['common.cancel', 'Cancel'],
      ['hello', 'Hello'],
    ])
    expect(compareLocales(source, target, 'en').empty).toEqual(['common.ok'])
    expect(compareLocales(source, target, 'en').translated).toBe(2)
  })

  it('is clean for an identical key set', () => {
    const target = new Map([
      ['common.ok', 'OK'],
      ['common.cancel', 'Cancel'],
      ['hello', 'Hello'],
    ])
    expect(compareLocales(source, target, 'en')).toEqual({
      locale: 'en',
      sourceKeys: 3,
      translated: 3,
      missing: [],
      extra: [],
      empty: [],
    })
  })

  it('keeps source order for missing keys', () => {
    expect(compareLocales(source, new Map(), 'ja').missing).toEqual([
      'common.ok',
      'common.cancel',
      'hello',
    ])
  })
})
