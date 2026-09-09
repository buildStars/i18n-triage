import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { loadConfigFile, resolveConfig } from './config'
import { scan } from './scan'

const here = path.dirname(fileURLToPath(import.meta.url))
const demo = path.resolve(here, '../../../examples/demo')

describe('scan(examples/demo)', async () => {
  const loaded = await loadConfigFile(demo)
  const config = resolveConfig(loaded?.config)
  const report = await scan([demo], { cwd: demo, config })
  const { summary } = report

  it('picks up the demo config file', () => {
    expect(loaded?.path.endsWith('i18n-triage.config.mjs')).toBe(true)
  })

  it('scans exactly the six source files', () => {
    expect(summary.files).toBe(6)
    expect(report.errors).toEqual([])
  })

  it('classifies the demo exactly as annotated in its sources', () => {
    expect(summary.byCategory).toEqual({
      A_UI_TEXT: 22,
      B_DEBUG_LOG: 8,
      C_DICT: 13,
      D_INTERNAL_KEY: 10,
    })
    expect(summary.fallback).toBe(5)
    expect(summary.i18nExcluded).toBe(2)
    expect(summary.classified).toBe(53)
  })

  it('counts the regex-style baseline above the classified total, so comments show up as ignored', () => {
    expect(summary.naive).toBeGreaterThan(summary.classified + summary.i18nExcluded)
    expect(summary.ignored).toBeGreaterThan(0)
    expect(summary.noiseRatio).toBeGreaterThan(0.5)
  })

  it('never reports anything from comments, styles, node_modules or dist', () => {
    const values = report.results.map((r) => r.node.value)
    expect(values.some((v) => v.includes('注释'))).toBe(false)
    expect(values.some((v) => v.includes('样式'))).toBe(false)
    expect(values).not.toContain('不应出现')
    expect(values).not.toContain('构建产物')
  })

  it('uses posix relative paths for loc.file', () => {
    const files = new Set(report.results.map((r) => r.node.loc.file))
    expect([...files].sort()).toEqual([
      'src/components/Tip.tsx',
      'src/constants/order.ts',
      'src/enums/pay.ts',
      'src/utils/logger.ts',
      'src/utils/toast.ts',
      'src/views/Order.vue',
    ])
  })

  it('honours the demo config: myToast is treated as a UI API', () => {
    const toast = report.results.find((r) => r.node.value === '操作成功')
    expect(toast).toMatchObject({ category: 'A_UI_TEXT', matchedBy: 'a-ui-text' })
  })

  it('records a parse failure instead of aborting the whole scan', async () => {
    const broken = await scan(['src/views/Order.vue', 'src/utils/logger.ts'], {
      cwd: demo,
      config,
      readFile: async (file) =>
        file.endsWith('Order.vue') ? Promise.reject(new Error('EACCES: denied')) : undefined,
    })
    expect(broken.summary.files).toBe(1)
    expect(broken.errors).toEqual([{ file: 'src/views/Order.vue', message: 'EACCES: denied' }])
  })
})
