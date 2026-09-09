import { describe, expect, it } from 'vitest'

import { matchesCallee, toKebabCase } from './callee-match'

describe('matchesCallee', () => {
  it('matches an exact name only', () => {
    expect(matchesCallee('showToast', ['showToast'])).toBe(true)
    expect(matchesCallee('showToastX', ['showToast'])).toBe(false)
    expect(matchesCallee('vant.showToast', ['showToast'])).toBe(false)
  })

  it('matches "name.*" when a non-final segment equals name', () => {
    expect(matchesCallee('console.log', ['console.*'])).toBe(true)
    expect(matchesCallee('console.error', ['console.*'])).toBe(true)
    expect(matchesCallee('window.console.log', ['console.*'])).toBe(true)
    expect(matchesCallee('this.$message.success', ['$message.*'])).toBe(true)
    expect(matchesCallee('console', ['console.*'])).toBe(false)
    expect(matchesCallee('myconsole.log', ['console.*'])).toBe(false)
    expect(matchesCallee('a.console', ['console.*'])).toBe(false)
  })

  it('matches "*.name" when the final segment equals name and there is a receiver', () => {
    expect(matchesCallee('i18n.t', ['*.t'])).toBe(true)
    expect(matchesCallee('i18n.global.t', ['*.t'])).toBe(true)
    expect(matchesCallee('this.$t', ['*.$t'])).toBe(true)
    expect(matchesCallee('t', ['*.t'])).toBe(false)
    expect(matchesCallee('i18n.tc', ['*.t'])).toBe(false)
  })

  it('matches exact dotted names', () => {
    expect(matchesCallee('ElMessageBox.confirm', ['ElMessageBox.confirm'])).toBe(true)
    expect(matchesCallee('ElMessageBox.alert', ['ElMessageBox.confirm'])).toBe(false)
  })

  it('returns true when any pattern matches', () => {
    expect(matchesCallee('logger.warn', ['console.*', 'logger.*'])).toBe(true)
    expect(matchesCallee('toast', ['console.*', 'logger.*'])).toBe(false)
  })
})

describe('toKebabCase', () => {
  it('converts camelCase attribute names to kebab-case', () => {
    expect(toKebabCase('confirmButtonText')).toBe('confirm-button-text')
    expect(toKebabCase('placeholder')).toBe('placeholder')
    expect(toKebabCase('confirm-button-text')).toBe('confirm-button-text')
    expect(toKebabCase('ariaLabel')).toBe('aria-label')
  })
})
