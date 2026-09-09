import type { TriageResult } from '@i18n-triage/core'
import { describe, expect, it } from 'vitest'

import { formatJson } from './json'
import { buildScanReport } from './report-model'

const a: TriageResult = {
  node: {
    value: '请输入订单号',
    kind: 'template-attr',
    attrName: 'placeholder',
    loc: { file: 'src/views/Order.vue', line: 45, column: 22, offset: 900 },
  },
  category: 'A_UI_TEXT',
  matchedBy: 'a-ui-text',
}
const b: TriageResult = {
  node: {
    value: '加载失败',
    kind: 'call-arg',
    calleeName: 'console.error',
    loc: { file: 'src/views/Order.vue', line: 70, column: 5, offset: 1400 },
  },
  category: 'B_DEBUG_LOG',
  matchedBy: 'b-debug-log',
}

const report = buildScanReport(
  [{ file: 'src/views/Order.vue', naiveCount: 10, i18nExcluded: 1, results: [a, b] }],
  [{ file: 'broken.vue', message: 'boom' }],
)

describe('formatJson', () => {
  it('produces valid JSON with a schema version, the summary, flattened results and errors', () => {
    const parsed = JSON.parse(formatJson(report)) as Record<string, unknown>
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.summary).toMatchObject({ files: 1, naive: 10, classified: 2, i18nExcluded: 1 })
    expect(parsed.results).toEqual([
      {
        file: 'src/views/Order.vue',
        line: 45,
        column: 22,
        offset: 900,
        value: '请输入订单号',
        kind: 'template-attr',
        attrName: 'placeholder',
        category: 'A_UI_TEXT',
        matchedBy: 'a-ui-text',
      },
      {
        file: 'src/views/Order.vue',
        line: 70,
        column: 5,
        offset: 1400,
        value: '加载失败',
        kind: 'call-arg',
        calleeName: 'console.error',
        category: 'B_DEBUG_LOG',
        matchedBy: 'b-debug-log',
      },
    ])
    expect(parsed.errors).toEqual([{ file: 'broken.vue', message: 'boom' }])
  })

  it('filters results by category while keeping the full summary', () => {
    const parsed = JSON.parse(formatJson(report, { only: ['A_UI_TEXT'] })) as {
      results: { category: string }[]
      summary: { classified: number }
    }
    expect(parsed.results.map((r) => r.category)).toEqual(['A_UI_TEXT'])
    expect(parsed.summary.classified).toBe(2)
  })

  it('pretty-prints by default and can emit a compact single line', () => {
    expect(formatJson(report)).toContain('\n')
    expect(formatJson(report, { pretty: false })).not.toContain('\n')
  })
})
