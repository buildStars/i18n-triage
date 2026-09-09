import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from './config'
import { discoverFiles, toPosixRelative } from './discover'

const here = path.dirname(fileURLToPath(import.meta.url))
const demo = path.resolve(here, '../../../examples/demo')
const config = resolveConfig()

describe('discoverFiles', () => {
  it('finds every source file under a directory, excluding node_modules and dist by default', async () => {
    const files = await discoverFiles([demo], { cwd: demo, config })
    expect(files.map((f) => f.relativePath)).toEqual([
      'src/components/Tip.tsx',
      'src/constants/order.ts',
      'src/enums/pay.ts',
      'src/utils/logger.ts',
      'src/utils/toast.ts',
      'src/views/Order.vue',
    ])
  })

  it('returns absolute paths', async () => {
    const files = await discoverFiles([demo], { cwd: demo, config })
    expect(files.every((f) => path.isAbsolute(f.absPath))).toBe(true)
  })

  it('accepts explicit files and relative directories, de-duplicated and sorted', async () => {
    const files = await discoverFiles(['src/utils', 'src/views/Order.vue', 'src/utils/logger.ts'], {
      cwd: demo,
      config,
    })
    expect(files.map((f) => f.relativePath)).toEqual([
      'src/utils/logger.ts',
      'src/utils/toast.ts',
      'src/views/Order.vue',
    ])
  })

  it('applies extra ignore globs from the config', async () => {
    const files = await discoverFiles([demo], {
      cwd: demo,
      config: resolveConfig({ ignore: ['**/utils/**'] }),
    })
    expect(files.some((f) => f.relativePath.includes('utils'))).toBe(false)
    expect(files.length).toBe(4)
  })

  it('does not include the config file itself or non-source files', async () => {
    const files = await discoverFiles([demo], { cwd: demo, config })
    expect(
      files.some((f) => f.relativePath.endsWith('.mjs') || f.relativePath.endsWith('.json')),
    ).toBe(false)
  })

  it('throws for a path that does not exist', async () => {
    await expect(discoverFiles(['nope/'], { cwd: demo, config })).rejects.toThrow(/nope/)
  })
})

describe('toPosixRelative', () => {
  it('produces forward-slash paths relative to the base', () => {
    expect(toPosixRelative('/a/b', '/a/b/src/x.vue')).toBe('src/x.vue')
    expect(toPosixRelative(path.join('a', 'b'), path.join('a', 'b', 'src', 'x.vue'))).toBe(
      'src/x.vue',
    )
  })

  it.runIf(process.platform === 'win32')('normalises Windows backslash paths', () => {
    expect(toPosixRelative('C:\\a\\b', 'C:\\a\\b\\src\\x.vue')).toBe('src/x.vue')
  })
})
