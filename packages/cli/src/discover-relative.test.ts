import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from './config'
import { discoverFiles } from './discover'
import { scan } from './scan'

const here = path.dirname(fileURLToPath(import.meta.url))
const demo = path.resolve(here, '../../../examples/demo')
const config = resolveConfig()

describe('discoverFiles — relativePath 的基准', () => {
  it('is relative to cwd when the target lives under cwd', async () => {
    const files = await discoverFiles(['examples/demo'], {
      cwd: path.resolve(demo, '../..'),
      config,
    })
    expect(files.map((f) => f.relativePath)).toContain('examples/demo/src/views/Order.vue')
  })

  it('is relative to the scanned directory when the target is outside cwd', async () => {
    const files = await discoverFiles([demo], { cwd: path.join(demo, 'src/views'), config })
    expect(files.map((f) => f.relativePath)).toEqual([
      'src/components/Tip.tsx',
      'src/constants/order.ts',
      'src/enums/pay.ts',
      'src/utils/logger.ts',
      'src/utils/toast.ts',
      'src/views/Order.vue',
    ])
    expect(files.every((f) => path.isAbsolute(f.absPath))).toBe(true)
  })

  it('never produces ../ segments', async () => {
    const files = await discoverFiles([demo, path.join(demo, 'src/utils/toast.ts')], {
      cwd: path.join(demo, 'src/views'),
      config,
    })
    expect(files.some((f) => f.relativePath.startsWith('..'))).toBe(false)
    expect(files.filter((f) => f.relativePath === 'src/utils/toast.ts')).toHaveLength(1)
  })
})

describe('scan — loc.file 跟随 relativePath 基准', () => {
  it('reports clean paths for a directory outside cwd', async () => {
    const report = await scan([demo], { cwd: path.join(demo, 'src/views'), config })
    const files = new Set(report.results.map((r) => r.node.loc.file))
    expect([...files].every((f) => !f.startsWith('..'))).toBe(true)
    expect(files.has('src/constants/order.ts')).toBe(true)
  })
})
