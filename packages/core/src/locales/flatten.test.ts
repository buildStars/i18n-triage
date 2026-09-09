import { describe, expect, it } from 'vitest'

import { flattenMessages } from './flatten'

describe('flattenMessages', () => {
  it('flattens nested objects into dotted keys', () => {
    expect(
      flattenMessages({
        common: { ok: '确定', cancel: '取消' },
        order: { status: { paid: '已支付' } },
      }),
    ).toEqual(
      new Map([
        ['common.ok', '确定'],
        ['common.cancel', '取消'],
        ['order.status.paid', '已支付'],
      ]),
    )
  })

  it('keeps flat keys as they are, including ones that contain dots or Chinese', () => {
    expect(flattenMessages({ '请稍候...': '请稍候...', 暂无数据: '暂无数据' })).toEqual(
      new Map([
        ['请稍候...', '请稍候...'],
        ['暂无数据', '暂无数据'],
      ]),
    )
  })

  it('applies a namespace prefix', () => {
    expect(flattenMessages({ home: '首页' }, 'menu')).toEqual(new Map([['menu.home', '首页']]))
  })

  it('indexes arrays and ignores non-string leaves', () => {
    expect(flattenMessages({ list: ['一', '二'], n: 3, ok: true, none: null })).toEqual(
      new Map([
        ['list.0', '一'],
        ['list.1', '二'],
      ]),
    )
  })

  it('returns an empty map for non-objects', () => {
    expect(flattenMessages(null)).toEqual(new Map())
    expect(flattenMessages('x')).toEqual(new Map())
  })
})
