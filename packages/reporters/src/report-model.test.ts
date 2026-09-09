import type { Category, StringKind, TriageResult } from '@i18n-triage/core'
import { describe, expect, it } from 'vitest'

import type { FileScan } from './report-model'
import { buildScanReport } from './report-model'

function result(
  file: string,
  offset: number,
  category: Category,
  matchedBy: string,
  value = 'x',
  kind: StringKind = 'literal',
): TriageResult {
  return {
    node: { value, kind, loc: { file, line: 1, column: offset + 1, offset } },
    category,
    matchedBy,
  }
}

describe('buildScanReport', () => {
  const files: FileScan[] = [
    {
      file: 'src/views/Order.vue',
      naiveCount: 20,
      i18nExcluded: 2,
      results: [
        result('src/views/Order.vue', 50, 'A_UI_TEXT', 'a-ui-text'),
        result('src/views/Order.vue', 10, 'A_UI_TEXT', 'fallback'),
        result('src/views/Order.vue', 30, 'B_DEBUG_LOG', 'b-debug-log'),
      ],
    },
    {
      file: 'src/constants/lottery.ts',
      naiveCount: 9,
      i18nExcluded: 0,
      results: [
        result('src/constants/lottery.ts', 5, 'C_DICT', 'c-dict'),
        result('src/constants/lottery.ts', 1, 'D_INTERNAL_KEY', 'd-internal-key'),
        result('src/constants/lottery.ts', 9, 'C_DICT', 'c-dict'),
      ],
    },
  ]
  const report = buildScanReport(files)

  it('counts files, naive runs, classified nodes and per-category totals', () => {
    expect(report.summary.files).toBe(2)
    expect(report.summary.naive).toBe(29)
    expect(report.summary.classified).toBe(6)
    expect(report.summary.byCategory).toEqual({
      A_UI_TEXT: 2,
      B_DEBUG_LOG: 1,
      C_DICT: 2,
      D_INTERNAL_KEY: 1,
    })
  })

  it('counts fallback A separately and sums i18n exclusions', () => {
    expect(report.summary.fallback).toBe(1)
    expect(report.summary.i18nExcluded).toBe(2)
  })

  it('derives ignored = naive - classified - i18nExcluded, never negative', () => {
    expect(report.summary.ignored).toBe(29 - 6 - 2)
    const tiny = buildScanReport([
      {
        file: 'a.ts',
        naiveCount: 1,
        i18nExcluded: 0,
        results: [result('a.ts', 0, 'A_UI_TEXT', 'x'), result('a.ts', 1, 'A_UI_TEXT', 'x')],
      },
    ])
    expect(tiny.summary.ignored).toBe(0)
  })

  it('computes the noise ratio as everything-but-A over naive', () => {
    expect(report.summary.noiseRatio).toBeCloseTo((29 - 2) / 29)
  })

  it('reports a zero noise ratio when nothing was scanned', () => {
    const empty = buildScanReport([])
    expect(empty.summary).toEqual({
      files: 0,
      naive: 0,
      classified: 0,
      byCategory: { A_UI_TEXT: 0, B_DEBUG_LOG: 0, C_DICT: 0, D_INTERNAL_KEY: 0 },
      fallback: 0,
      i18nExcluded: 0,
      ignored: 0,
      noiseRatio: 0,
    })
    expect(empty.results).toEqual([])
    expect(empty.errors).toEqual([])
  })

  it('sorts results by file path then offset', () => {
    expect(report.results.map((r) => `${r.node.loc.file}@${r.node.loc.offset}`)).toEqual([
      'src/constants/lottery.ts@1',
      'src/constants/lottery.ts@5',
      'src/constants/lottery.ts@9',
      'src/views/Order.vue@10',
      'src/views/Order.vue@30',
      'src/views/Order.vue@50',
    ])
  })

  it('carries per-file errors through', () => {
    const withErrors = buildScanReport([], [{ file: 'broken.vue', message: 'boom' }])
    expect(withErrors.errors).toEqual([{ file: 'broken.vue', message: 'boom' }])
  })
})
