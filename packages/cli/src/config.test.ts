import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { DEFAULT_I18N_CALLEES, DEFAULT_UI_APIS } from '@i18n-triage/core'
import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_IGNORE, defineConfig, loadConfigFile, parseOnly, resolveConfig } from './config'

describe('resolveConfig', () => {
  it('fills defaults when the user config is empty', () => {
    const c = resolveConfig()
    expect(c.include).toEqual(['**/*.{vue,ts,js,tsx,jsx}'])
    expect(c.ignore).toEqual([...DEFAULT_IGNORE])
    // Day 7 真实项目验证：翻译表本身、mock、测试、压缩产物默认不扫
    expect(DEFAULT_IGNORE).toEqual(
      expect.arrayContaining([
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**',
        '**/locales/**',
        '**/locale/**',
        '**/lang/**',
        '**/langs/**',
        '**/i18n/**',
        '**/translations/**',
        '**/translate/**',
        '**/zh-CN.*',
        '**/zh_CN.*',
        '**/zh.*',
        '**/mock/**',
        '**/mocks/**',
        '**/__mocks__/**',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.min.js',
        '**/*.umd.js',
        '**/*.d.ts',
      ]),
    )
    expect(c.only).toEqual(['A_UI_TEXT', 'C_DICT'])
    expect(c.format).toBe('text')
    expect(c.rulesConfig).toEqual({})
    expect(c.i18nCallees).toEqual(DEFAULT_I18N_CALLEES)
  })

  it('appends user lists to the built-in ones by default (extendDefaults: true)', () => {
    const c = resolveConfig({
      uiApis: ['myToast'],
      i18nCallees: ['translate'],
      ignore: ['**/legacy/**'],
    })
    expect(c.rulesConfig.uiApis).toEqual([...DEFAULT_UI_APIS, 'myToast'])
    expect(c.i18nCallees).toEqual([...DEFAULT_I18N_CALLEES, 'translate'])
    expect(c.ignore).toContain('**/legacy/**')
    expect(c.ignore).toContain('**/node_modules/**')
  })

  it('replaces the built-in lists when extendDefaults is false', () => {
    const c = resolveConfig({ extendDefaults: false, uiApis: ['myToast'], debugApis: ['trace.*'] })
    expect(c.rulesConfig.uiApis).toEqual(['myToast'])
    expect(c.rulesConfig.debugApis).toEqual(['trace.*'])
    expect(c.rulesConfig.displayAttrs).toBeUndefined()
  })

  it('passes the dictionary threshold through and accepts only / format / include', () => {
    const c = resolveConfig({
      dictSiblingThreshold: 5,
      only: 'A,B',
      format: 'json',
      include: ['src/**/*.vue'],
    })
    expect(c.rulesConfig.dictSiblingThreshold).toBe(5)
    expect(c.only).toEqual(['A_UI_TEXT', 'B_DEBUG_LOG'])
    expect(c.format).toBe('json')
    expect(c.include).toEqual(['src/**/*.vue'])
  })

  it('accepts sarif as an output format', () => {
    expect(resolveConfig({ format: 'sarif' }).format).toBe('sarif')
  })

  it('defineConfig is an identity helper for typing', () => {
    const cfg = { uiApis: ['x'] }
    expect(defineConfig(cfg)).toBe(cfg)
  })
})

describe('parseOnly', () => {
  it('maps letters to categories, case-insensitively, ignoring blanks', () => {
    expect(parseOnly('A,C')).toEqual(['A_UI_TEXT', 'C_DICT'])
    expect(parseOnly(' d , b ')).toEqual(['D_INTERNAL_KEY', 'B_DEBUG_LOG'])
    expect(parseOnly('all')).toEqual(['A_UI_TEXT', 'B_DEBUG_LOG', 'C_DICT', 'D_INTERNAL_KEY'])
  })

  it('rejects unknown letters', () => {
    expect(() => parseOnly('A,X')).toThrow(/X/)
  })
})

describe('loadConfigFile', () => {
  let dir: string
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('returns undefined when no config file exists', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'i18n-triage-'))
    expect(await loadConfigFile(dir)).toBeUndefined()
  })

  it('loads i18n-triage.config.json', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'i18n-triage-'))
    await writeFile(
      path.join(dir, 'i18n-triage.config.json'),
      JSON.stringify({ uiApis: ['fromJson'] }),
    )
    const loaded = await loadConfigFile(dir)
    expect(loaded?.path).toBe(path.join(dir, 'i18n-triage.config.json'))
    expect(loaded?.config).toEqual({ uiApis: ['fromJson'] })
  })

  it('loads an ESM .mjs config with a default export', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'i18n-triage-'))
    await writeFile(
      path.join(dir, 'i18n-triage.config.mjs'),
      `export default { uiApis: ['fromMjs'] }`,
    )
    const loaded = await loadConfigFile(dir)
    expect(loaded?.config).toEqual({ uiApis: ['fromMjs'] })
  })

  it('loads a TypeScript config', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'i18n-triage-'))
    await writeFile(
      path.join(dir, 'i18n-triage.config.ts'),
      `const cfg: { uiApis: string[] } = { uiApis: ['fromTs'] }\nexport default cfg\n`,
    )
    const loaded = await loadConfigFile(dir)
    expect(loaded?.config).toEqual({ uiApis: ['fromTs'] })
  })

  it('falls back to the scanned directories when cwd has no config', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'i18n-triage-'))
    const target = path.join(dir, 'app')
    await mkdir(target)
    await writeFile(
      path.join(target, 'i18n-triage.config.json'),
      JSON.stringify({ uiApis: ['fromTarget'] }),
    )
    const loaded = await loadConfigFile(dir, undefined, [target])
    expect(loaded?.path).toBe(path.join(target, 'i18n-triage.config.json'))
    expect(loaded?.config).toEqual({ uiApis: ['fromTarget'] })
  })

  it('prefers cwd over the fallback directories', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'i18n-triage-'))
    const target = path.join(dir, 'app')
    await mkdir(target)
    await writeFile(
      path.join(dir, 'i18n-triage.config.json'),
      JSON.stringify({ uiApis: ['fromCwd'] }),
    )
    await writeFile(
      path.join(target, 'i18n-triage.config.json'),
      JSON.stringify({ uiApis: ['fromTarget'] }),
    )
    expect((await loadConfigFile(dir, undefined, [target]))?.config).toEqual({
      uiApis: ['fromCwd'],
    })
  })

  it('honours an explicit path and fails loudly when it does not exist', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'i18n-triage-'))
    const custom = path.join(dir, 'custom.config.json')
    await writeFile(custom, JSON.stringify({ format: 'json' }))
    expect((await loadConfigFile(dir, custom))?.config).toEqual({ format: 'json' })
    await expect(loadConfigFile(dir, path.join(dir, 'missing.json'))).rejects.toThrow(
      /missing\.json/,
    )
  })
})
