import type { Category, StringKind, StringNode, TriageResult } from '@i18n-triage/core'
import { describe, expect, it } from 'vitest'

import { displayWidth } from './display-width'
import type { FileScan } from './report-model'
import { buildScanReport } from './report-model'
import { formatText } from './text'

function result(
  file: string,
  line: number,
  column: number,
  category: Category,
  matchedBy: string,
  value: string,
  kind: StringKind,
  extra: Partial<Pick<StringNode, 'attrName' | 'calleeName' | 'siblingChineseCount'>> = {},
): TriageResult {
  return {
    node: { value, kind, loc: { file, line, column, offset: line * 1000 + column }, ...extra },
    category,
    matchedBy,
  }
}

const files: FileScan[] = [
  {
    file: 'src/views/Order.vue',
    naiveCount: 3214,
    i18nExcluded: 40,
    results: [
      result('src/views/Order.vue', 12, 14, 'A_UI_TEXT', 'a-ui-text', '暂无数据', 'template-text'),
      result(
        'src/views/Order.vue',
        45,
        22,
        'A_UI_TEXT',
        'a-ui-text',
        '请输入订单号',
        'template-attr',
        {
          attrName: 'placeholder',
        },
      ),
      result('src/views/Order.vue', 50, 3, 'A_UI_TEXT', 'fallback', '埋点名', 'template-attr', {
        attrName: 'data-track',
      }),
      result('src/views/Order.vue', 60, 5, 'A_UI_TEXT', 'a-ui-text', '保存成功', 'call-arg', {
        calleeName: 'showToast',
      }),
      result('src/views/Order.vue', 70, 5, 'B_DEBUG_LOG', 'b-debug-log', '加载失败', 'call-arg', {
        calleeName: 'console.error',
      }),
    ],
  },
  {
    file: 'src/constants/lottery.ts',
    naiveCount: 0,
    i18nExcluded: 0,
    results: [
      result('src/constants/lottery.ts', 2, 20, 'C_DICT', 'c-dict', '红波', 'object-value', {
        siblingChineseCount: 3,
      }),
      result('src/constants/lottery.ts', 3, 20, 'C_DICT', 'c-dict', '蓝波', 'object-value', {
        siblingChineseCount: 3,
      }),
      result(
        'src/constants/lottery.ts',
        1,
        24,
        'D_INTERNAL_KEY',
        'd-internal-key',
        '红波',
        'object-key',
      ),
    ],
  },
]

const report = buildScanReport(files)

describe('formatText — 摘要', () => {
  const out = formatText(report, { color: false })

  it('starts with the file count', () => {
    expect(out.startsWith('i18n-triage  扫描 2 个文件')).toBe(true)
  })

  it('lists every category with thousands separators and the noise ratio line', () => {
    expect(out).toContain('扫到含中文片段')
    expect(out).toContain('3,214 处')
    expect(out).toMatch(/A 必翻译 UI 文案\s+4 处\s+← 需处理（其中 1 处待确认）/)
    expect(out).toMatch(/B 调试日志\s+1 处\s+（已归档）/)
    expect(out).toMatch(/C 数据字典\s+2 处\s+← 需独立方案/)
    expect(out).toMatch(/D 内部键\s+1 处\s+（已归档）/)
    expect(out).toMatch(/已接入 i18n 的调用\s+40 处/)
    expect(out).toMatch(/注释等已忽略\s+3,166 处/)
  })

  it('prints the headline noise ratio: naive → A, with percentage', () => {
    expect(out).toContain('降噪比    3,214 → 4  （99.9% 为噪音）')
  })

  it('aligns the count column across plain and tree-prefixed summary lines (in display cells)', () => {
    const summaryBlock = out.slice(out.indexOf('━━ 摘要 ━━'), out.indexOf('降噪比'))
    const countColumns = summaryBlock
      .split('\n')
      .filter((line) => / 处/.test(line))
      .map((line) => displayWidth(line.slice(0, line.indexOf(' 处'))))
    expect(countColumns.length).toBe(7)
    expect(new Set(countColumns).size).toBe(1)
  })
})

describe('formatText — 分类明细', () => {
  it('shows A items grouped by file with line:column, quoted value, kind and context', () => {
    const out = formatText(report, { color: false, only: ['A_UI_TEXT'] })
    expect(out).toContain('━━ A 必翻译 UI 文案（4）━━')
    expect(out).toContain('  src/views/Order.vue')
    expect(out).toMatch(/12:14\s+"暂无数据"\s+template-text/)
    expect(out).toMatch(/45:22\s+"请输入订单号"\s+template-attr\s+placeholder/)
    expect(out).toMatch(/60:5\s+"保存成功"\s+call-arg\s+showToast/)
    expect(out).not.toContain('━━ C 数据字典')
    expect(out).not.toContain('加载失败')
  })

  it('marks fallback A items as 待确认', () => {
    const out = formatText(report, { color: false, only: ['A_UI_TEXT'] })
    expect(out).toMatch(/50:3\s+"埋点名"\s+template-attr\s+data-track\s+待确认/)
    expect(out).not.toMatch(/12:14.*待确认/)
  })

  it('summarises C per file with the dictionary hint instead of listing every string', () => {
    const out = formatText(report, { color: false, only: ['C_DICT'] })
    expect(out).toContain('━━ C 数据字典（2）━━')
    expect(out).toContain('提示：字典类文案建议走配置化翻译表，不要逐句抽 key')
    expect(out).toMatch(/src\/constants\/lottery\.ts\s+2 处（同一对象内 ≥3 个中文 value）/)
    expect(out).not.toContain('"红波"')
  })

  it('shows the configured dictionary threshold in the hint', () => {
    const out = formatText(report, { color: false, only: ['C_DICT'], dictSiblingThreshold: 5 })
    expect(out).toContain('≥5 个中文 value')
  })

  it('defaults to showing A and C only', () => {
    const out = formatText(report, { color: false })
    expect(out).toContain('━━ A 必翻译 UI 文案（4）━━')
    expect(out).toContain('━━ C 数据字典（2）━━')
    expect(out).not.toContain('━━ B 调试日志')
    expect(out).not.toContain('━━ D 内部键')
  })

  it('lists B and D items when asked', () => {
    const out = formatText(report, { color: false, only: ['B_DEBUG_LOG', 'D_INTERNAL_KEY'] })
    expect(out).toContain('━━ B 调试日志（1）━━')
    expect(out).toMatch(/70:5\s+"加载失败"\s+call-arg\s+console\.error/)
    expect(out).toContain('━━ D 内部键（1）━━')
    expect(out).toMatch(/1:24\s+"红波"\s+object-key/)
  })

  it('truncates very long values with an ellipsis', () => {
    const long = buildScanReport([
      {
        file: 'a.vue',
        naiveCount: 1,
        i18nExcluded: 0,
        results: [
          result(
            'a.vue',
            1,
            1,
            'A_UI_TEXT',
            'a-ui-text',
            '这是一段非常非常非常非常非常非常长的提示文案用来测试截断',
            'template-text',
          ),
        ],
      },
    ])
    const out = formatText(long, { color: false })
    expect(out).toContain('…')
    expect(out).not.toContain('测试截断')
  })
})

describe('formatText — 边界', () => {
  it('handles an empty scan without dividing by zero', () => {
    const out = formatText(buildScanReport([]), { color: false })
    expect(out).toContain('扫描 0 个文件')
    expect(out).toContain('降噪比    0 → 0')
    expect(out).not.toContain('NaN')
  })

  it('prints parse errors at the end', () => {
    const out = formatText(
      buildScanReport([], [{ file: 'broken.vue', message: 'Unexpected token' }]),
      { color: false },
    )
    expect(out).toContain('━━ 解析失败（1）━━')
    expect(out).toContain('broken.vue')
    expect(out).toContain('Unexpected token')
  })

  it('emits ANSI codes only when color is enabled', () => {
    const esc = String.fromCharCode(27)
    expect(formatText(report, { color: false })).not.toContain(`${esc}[`)
    expect(formatText(report, { color: true })).toContain(`${esc}[`)
  })
})
