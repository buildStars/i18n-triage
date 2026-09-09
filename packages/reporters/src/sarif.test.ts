import type { TriageResult } from '@i18n-triage/core'
import { describe, expect, it } from 'vitest'

import { buildScanReport } from './report-model'
import type { SarifLog } from './sarif'
import { SARIF_RULE_IDS, formatSarif, toSarif } from './sarif'

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
const aFallback: TriageResult = {
  node: {
    value: '已完成',
    kind: 'literal',
    loc: { file: 'src/views/Order.vue', line: 19, column: 26, offset: 500 },
  },
  category: 'A_UI_TEXT',
  matchedBy: 'fallback',
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
const c: TriageResult = {
  node: {
    value: '红波',
    kind: 'object-value',
    attrName: 'label',
    siblingChineseCount: 3,
    loc: { file: 'src/constants/lottery.ts', line: 2, column: 20, offset: 40 },
  },
  category: 'C_DICT',
  matchedBy: 'c-dict',
}

const report = buildScanReport(
  [
    { file: 'src/views/Order.vue', naiveCount: 10, i18nExcluded: 1, results: [a, aFallback, b] },
    { file: 'src/constants/lottery.ts', naiveCount: 3, i18nExcluded: 0, results: [c] },
  ],
  [{ file: 'broken.vue', message: 'Unexpected token' }],
  [{ file: 'vendor/ui/index.umd.js', reason: 'minified' }],
)

const run = (log: SarifLog) => {
  const first = log.runs[0]
  if (!first) throw new Error('no run')
  return first
}

describe('toSarif — 结构', () => {
  const log = toSarif(report, {
    toolVersion: '0.1.0',
    informationUri: 'https://example.com/i18n-triage',
  })

  it('is a SARIF 2.1.0 log with exactly one run', () => {
    expect(log.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json')
    expect(log.version).toBe('2.1.0')
    expect(log.runs).toHaveLength(1)
  })

  it('describes the tool and declares one rule per category in a stable order', () => {
    const { driver } = run(log).tool
    expect(driver.name).toBe('i18n-triage')
    expect(driver.version).toBe('0.1.0')
    expect(driver.informationUri).toBe('https://example.com/i18n-triage')
    expect(driver.rules.map((r) => r.id)).toEqual([
      'i18n-triage/A_UI_TEXT',
      'i18n-triage/B_DEBUG_LOG',
      'i18n-triage/C_DICT',
      'i18n-triage/D_INTERNAL_KEY',
    ])
    expect(SARIF_RULE_IDS.A_UI_TEXT).toBe('i18n-triage/A_UI_TEXT')
    expect(driver.rules[0]?.defaultConfiguration.level).toBe('warning')
    expect(driver.rules[2]?.defaultConfiguration.level).toBe('note')
    expect(driver.rules.every((r) => r.shortDescription.text.length > 0)).toBe(true)
    expect(driver.rules.every((r) => r.properties.tags.includes('i18n'))).toBe(true)
  })

  it('reports columns as UTF-16 code units, matching the parsers', () => {
    expect(run(log).columnKind).toBe('utf16CodeUnits')
  })
})

describe('toSarif — results', () => {
  const log = toSarif(report, { toolVersion: '0.1.0' })
  const results = run(log).results

  it('only includes A and C by default, sorted like the report', () => {
    expect(results.map((r) => r.ruleId)).toEqual([
      'i18n-triage/C_DICT',
      'i18n-triage/A_UI_TEXT',
      'i18n-triage/A_UI_TEXT',
    ])
  })

  it('keeps ruleIndex consistent with the rules array', () => {
    const { rules } = run(log).tool.driver
    for (const r of results) expect(rules[r.ruleIndex]?.id).toBe(r.ruleId)
  })

  it('points at the file, line and column with a %SRCROOT% base', () => {
    const attr = results.find((r) => r.properties.value === '请输入订单号')
    expect(attr?.locations).toEqual([
      {
        physicalLocation: {
          artifactLocation: { uri: 'src/views/Order.vue', uriBaseId: '%SRCROOT%' },
          region: { startLine: 45, startColumn: 22 },
        },
      },
    ])
  })

  it('uses warning for rule-matched A, note for fallback A and for C', () => {
    const byValue = (v: string) => results.find((r) => r.properties.value === v)
    expect(byValue('请输入订单号')?.level).toBe('warning')
    expect(byValue('已完成')?.level).toBe('note')
    expect(byValue('红波')?.level).toBe('note')
  })

  it('writes a readable message with the value, kind and context', () => {
    const attr = results.find((r) => r.properties.value === '请输入订单号')
    expect(attr?.message.text).toContain('"请输入订单号"')
    expect(attr?.message.text).toContain('template-attr')
    expect(attr?.message.text).toContain('placeholder')
    const fb = results.find((r) => r.properties.value === '已完成')
    expect(fb?.message.text).toContain('待确认')
  })

  it('carries kind / matchedBy / attrName / calleeName in properties', () => {
    const dict = results.find((r) => r.properties.value === '红波')
    expect(dict?.properties).toEqual({
      value: '红波',
      kind: 'object-value',
      matchedBy: 'c-dict',
      attrName: 'label',
      siblingChineseCount: 3,
    })
  })

  it('emits a partial fingerprint that survives line moves but changes with the text', () => {
    const moved = buildScanReport([
      {
        file: 'src/views/Order.vue',
        naiveCount: 1,
        i18nExcluded: 0,
        results: [{ ...a, node: { ...a.node, loc: { ...a.node.loc, line: 99, column: 3 } } }],
      },
    ])
    const changed = buildScanReport([
      {
        file: 'src/views/Order.vue',
        naiveCount: 1,
        i18nExcluded: 0,
        results: [{ ...a, node: { ...a.node, value: '请输入订单编号' } }],
      },
    ])
    const fp = (log: SarifLog) => run(log).results[0]?.partialFingerprints['i18nTriage/v1']
    const original = results.find((r) => r.properties.value === '请输入订单号')
      ?.partialFingerprints['i18nTriage/v1']
    expect(original).toMatch(/^[0-9a-f]{8}$/)
    expect(fp(toSarif(moved))).toBe(original)
    expect(fp(toSarif(changed))).not.toBe(original)
  })

  it('honours the only option', () => {
    const all = toSarif(report, { only: ['A_UI_TEXT', 'B_DEBUG_LOG', 'C_DICT', 'D_INTERNAL_KEY'] })
    expect(run(all).results).toHaveLength(4)
    const onlyB = toSarif(report, { only: ['B_DEBUG_LOG'] })
    expect(run(onlyB).results.map((r) => r.ruleId)).toEqual(['i18n-triage/B_DEBUG_LOG'])
  })
})

describe('toSarif — invocation, notifications and summary', () => {
  const log = toSarif(report)
  const invocation = run(log).invocations[0]

  it('marks the invocation unsuccessful when files failed to parse', () => {
    expect(invocation?.executionSuccessful).toBe(false)
    expect(toSarif(buildScanReport([])).runs[0]?.invocations[0]?.executionSuccessful).toBe(true)
  })

  it('turns parse errors into error notifications and skipped files into notes', () => {
    expect(invocation?.toolExecutionNotifications).toEqual([
      {
        level: 'error',
        message: { text: 'Unexpected token' },
        locations: [
          { physicalLocation: { artifactLocation: { uri: 'broken.vue', uriBaseId: '%SRCROOT%' } } },
        ],
      },
      {
        level: 'note',
        message: { text: '跳过疑似压缩 / 生成文件（minified）' },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: 'vendor/ui/index.umd.js', uriBaseId: '%SRCROOT%' },
            },
          },
        ],
      },
    ])
  })

  it('attaches the full summary to the run', () => {
    expect(run(log).properties.summary).toEqual(report.summary)
  })
})

describe('formatSarif', () => {
  it('serialises to JSON, pretty by default', () => {
    const text = formatSarif(report)
    expect(text).toContain('\n')
    expect((JSON.parse(text) as SarifLog).version).toBe('2.1.0')
    expect(formatSarif(report, { pretty: false })).not.toContain('\n')
  })
})
