import { describe, expect, it } from 'vitest'

import { buildScanReport } from './report-model'
import { formatText } from './text'

describe('buildScanReport — skipped files', () => {
  it('carries skipped files with their reason and defaults to an empty list', () => {
    expect(buildScanReport([]).skipped).toEqual([])
    const report = buildScanReport([], [], [{ file: 'vendor/ui/index.umd.js', reason: 'minified' }])
    expect(report.skipped).toEqual([{ file: 'vendor/ui/index.umd.js', reason: 'minified' }])
    expect(report.summary.files).toBe(0)
  })
})

describe('formatText — skipped files', () => {
  it('mentions skipped files in the summary and lists them at the end', () => {
    const report = buildScanReport(
      [],
      [],
      [
        { file: 'vendor/ui/index.umd.js', reason: 'minified' },
        { file: 'vendor/ui/index.js', reason: 'too-large' },
      ],
    )
    const out = formatText(report, { color: false })
    expect(out).toMatch(/跳过疑似压缩 \/ 生成文件\s+2 个/)
    expect(out).toContain('━━ 已跳过（2）━━')
    expect(out).toMatch(/vendor\/ui\/index\.umd\.js\s+minified/)
    expect(out).toMatch(/vendor\/ui\/index\.js\s+too-large/)
  })

  it('omits the skipped line and section when nothing was skipped', () => {
    const out = formatText(buildScanReport([]), { color: false })
    expect(out).not.toContain('跳过')
    expect(out).not.toContain('已跳过')
  })
})
