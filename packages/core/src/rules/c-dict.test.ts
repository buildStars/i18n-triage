import { describe, expect, it } from 'vitest'

import { makeCtx, makeNode } from '../test-utils/make-node'
import { cDictRule, createDictRule, isInDictPath } from './c-dict'

const dictValue = (count: number) =>
  makeNode('object-value', '红波', { siblingChineseCount: count })

describe('isInDictPath', () => {
  it('matches dictionary directories at any depth, with / or \\ separators', () => {
    expect(isInDictPath('src/constants/lottery.ts')).toBe(true)
    expect(isInDictPath('src/modules/game/enums/status.ts')).toBe(true)
    expect(isInDictPath('src/enum/color.ts')).toBe(true)
    expect(isInDictPath('src/dict/index.ts')).toBe(true)
    expect(isInDictPath('src\\constants\\lottery.ts')).toBe(true)
  })

  it('matches files named after a dictionary directory', () => {
    expect(isInDictPath('src/constants.ts')).toBe(true)
    expect(isInDictPath('src/utils/enums.js')).toBe(true)
  })

  it('does not match ordinary paths or partial segment names', () => {
    expect(isInDictPath('src/views/Order.vue')).toBe(false)
    expect(isInDictPath('src/my-constants/x.ts')).toBe(false)
    expect(isInDictPath('src/constants-old/x.ts')).toBe(false)
    expect(isInDictPath('src/utils/constant-helper.ts')).toBe(false)
  })

  it('accepts a custom directory list', () => {
    expect(isInDictPath('src/dictionaries/x.ts', ['dictionaries'])).toBe(true)
    expect(isInDictPath('src/constants/x.ts', ['dictionaries'])).toBe(false)
  })
})

describe('cDictRule', () => {
  it('has a stable ruleName for reports', () => {
    expect(cDictRule.ruleName).toBe('c-dict')
  })

  it('classifies object values with >= 3 Chinese siblings inside constants/ as C', () => {
    expect(cDictRule(dictValue(3), makeCtx('src/constants/lottery.ts'))).toBe('C_DICT')
    expect(cDictRule(dictValue(12), makeCtx('src/modules/game/enums/status.ts'))).toBe('C_DICT')
  })

  it('does not match below the sibling threshold', () => {
    expect(cDictRule(dictValue(2), makeCtx('src/constants/lottery.ts'))).toBe(null)
    expect(cDictRule(dictValue(0), makeCtx('src/constants/lottery.ts'))).toBe(null)
    expect(cDictRule(makeNode('object-value', '红波'), makeCtx('src/constants/lottery.ts'))).toBe(
      null,
    )
  })

  it('does not match outside dictionary paths, even with many siblings', () => {
    expect(cDictRule(dictValue(10), makeCtx('src/views/Order.vue'))).toBe(null)
  })

  it('only applies to object-value nodes', () => {
    const ctx = makeCtx('src/constants/lottery.ts')
    expect(cDictRule(makeNode('object-key', '红波'), ctx)).toBe(null)
    expect(cDictRule(makeNode('call-arg', '红波', { calleeName: 'showToast' }), ctx)).toBe(null)
    expect(cDictRule(makeNode('literal', '红波'), ctx)).toBe(null)
  })
})

describe('createDictRule (configurable)', () => {
  it('honours a custom sibling threshold', () => {
    const rule = createDictRule({ siblingThreshold: 2 })
    expect(rule(dictValue(2), makeCtx('src/constants/lottery.ts'))).toBe('C_DICT')
    expect(rule(dictValue(1), makeCtx('src/constants/lottery.ts'))).toBe(null)
  })

  it('honours a custom directory list', () => {
    const rule = createDictRule({ dictDirs: ['dictionaries'] })
    expect(rule(dictValue(5), makeCtx('src/dictionaries/x.ts'))).toBe('C_DICT')
    expect(rule(dictValue(5), makeCtx('src/constants/x.ts'))).toBe(null)
  })
})
