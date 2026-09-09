import { describe, expect, it } from 'vitest'

import { displayWidth, padEndDisplay, truncateDisplay } from './display-width'

describe('displayWidth', () => {
  it('counts ASCII as 1 cell and CJK as 2 cells', () => {
    expect(displayWidth('abc')).toBe(3)
    expect(displayWidth('暂无数据')).toBe(8)
    expect(displayWidth('订单 #12')).toBe(8)
  })

  it('counts full-width punctuation as 2 cells and the empty string as 0', () => {
    expect(displayWidth('，。')).toBe(4)
    expect(displayWidth('')).toBe(0)
  })
})

describe('padEndDisplay', () => {
  it('pads with spaces to the requested display width', () => {
    expect(padEndDisplay('暂无', 8)).toBe('暂无    ')
    expect(padEndDisplay('abc', 5)).toBe('abc  ')
  })

  it('never truncates when the text is already wider', () => {
    expect(padEndDisplay('暂无数据', 4)).toBe('暂无数据')
  })
})

describe('truncateDisplay', () => {
  it('returns short text unchanged', () => {
    expect(truncateDisplay('暂无数据', 10)).toBe('暂无数据')
  })

  it('cuts to the width and appends an ellipsis, counting the ellipsis itself', () => {
    expect(truncateDisplay('请输入订单号并确认', 9)).toBe('请输入订…')
    expect(displayWidth(truncateDisplay('请输入订单号并确认', 9))).toBeLessThanOrEqual(9)
  })

  it('handles mixed-width text', () => {
    expect(truncateDisplay('ab中文cd', 5)).toBe('ab中…')
  })
})
