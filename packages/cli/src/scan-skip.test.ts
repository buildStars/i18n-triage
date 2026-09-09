import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from './config'
import { isProbablyGenerated, scan } from './scan'

const here = path.dirname(fileURLToPath(import.meta.url))
const demo = path.resolve(here, '../../../examples/demo')

describe('isProbablyGenerated', () => {
  it('flags files with an extremely long line as minified', () => {
    expect(isProbablyGenerated(`var a=1;${'x'.repeat(6000)}`, 300_000)).toBe('minified')
  })

  it('flags files above the size limit', () => {
    expect(isProbablyGenerated('a\n'.repeat(200_000), 300_000)).toBe('too-large')
  })

  it('accepts ordinary sources, including large hand-written ones', () => {
    expect(
      isProbablyGenerated(`<template>\n${'  <p>正文</p>\n'.repeat(4000)}</template>`, 300_000),
    ).toBe(null)
  })
})

describe('scan — 跳过压缩 / 超大文件', () => {
  it('skips generated files, records the reason and keeps scanning the rest', async () => {
    const report = await scan(['src/utils/logger.ts', 'src/utils/toast.ts'], {
      cwd: demo,
      config: resolveConfig(),
      readFile: async (file) =>
        file.endsWith('logger.ts') ? `export const s = '${'压'.repeat(6000)}'` : undefined,
    })
    expect(report.skipped).toEqual([{ file: 'src/utils/logger.ts', reason: 'minified' }])
    expect(report.summary.files).toBe(1)
    expect(report.errors).toEqual([])
  })

  it('honours a custom maxFileSize from the config', async () => {
    const report = await scan(['src/utils/toast.ts'], {
      cwd: demo,
      config: resolveConfig({ maxFileSize: 10 }),
    })
    expect(report.skipped).toEqual([{ file: 'src/utils/toast.ts', reason: 'too-large' }])
    expect(report.summary.files).toBe(0)
  })
})
