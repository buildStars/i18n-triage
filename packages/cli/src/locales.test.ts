import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { resolveConfig } from './config'
import {
  detectLocaleFile,
  formatLocalesJson,
  formatLocalesText,
  localesExitCode,
  runLocales,
} from './locales'

const here = path.dirname(fileURLToPath(import.meta.url))
const demo = path.resolve(here, '../../../examples/locales-demo')

describe('detectLocaleFile', () => {
  it('recognises <locale>.<ext> files', () => {
    expect(detectLocaleFile('src/locales/zh-CN.json')).toEqual({
      locale: 'zh-CN',
      namespace: undefined,
    })
    expect(detectLocaleFile('src/locales/en.ts')).toEqual({ locale: 'en', namespace: undefined })
    expect(detectLocaleFile('src/lang/zh_CN.js')).toEqual({ locale: 'zh_CN', namespace: undefined })
    expect(detectLocaleFile('src/locales/zh-Hans.json')).toEqual({
      locale: 'zh-Hans',
      namespace: undefined,
    })
  })

  it('recognises <locale>/<namespace>.<ext> files', () => {
    expect(detectLocaleFile('packages/locales/src/langs/zh-CN/common.json')).toEqual({
      locale: 'zh-CN',
      namespace: 'common',
    })
    expect(detectLocaleFile('src/locales/ja/menu.json')).toEqual({
      locale: 'ja',
      namespace: 'menu',
    })
  })

  it('rejects files whose name is not a locale code', () => {
    expect(detectLocaleFile('src/locales/index.ts')).toBeUndefined()
    expect(detectLocaleFile('src/locales/menu.json')).toBeUndefined()
    expect(detectLocaleFile('src/i18n/setup.ts')).toBeUndefined()
  })
})

describe('runLocales on examples/locales-demo', async () => {
  const config = resolveConfig()
  const result = await runLocales([], { cwd: demo, config })
  const { audit } = result

  it('finds the locale files, skips index.ts and groups by locale with namespaces', () => {
    expect(
      result.files.map((f) => `${f.file}→${f.locale}${f.namespace ? ':' + f.namespace : ''}`),
    ).toEqual([
      'src/locales/en-US.json→en-US',
      'src/locales/ja/menu.json→ja:menu',
      'src/locales/zh-CN.json→zh-CN',
      'src/locales/zh-CN/menu.json→zh-CN:menu',
      'src/locales/zh-TW.ts→zh-TW',
    ])
    expect(result.errors).toEqual([])
  })

  it('uses zh-CN as the source and merges its two files', () => {
    expect(audit.sourceLocale).toBe('zh-CN')
    expect(audit.sourceKeys).toBe(9)
  })

  it('reports completeness per target locale', () => {
    const byLocale = Object.fromEntries(audit.diffs.map((d) => [d.locale, d]))
    expect(byLocale['en-US']).toMatchObject({
      missing: ['common.unused', 'typo', 'menu.home'],
      extra: ['onlyInEn'],
      empty: ['common.cancel'],
      translated: 5,
    })
    expect(byLocale['ja']).toMatchObject({
      missing: expect.arrayContaining(['common.ok', 'hello']),
      extra: [],
      empty: [],
    })
    expect(byLocale['ja']?.missing).toHaveLength(8)
    expect(byLocale['zh-TW']?.missing).toHaveLength(7)
  })

  it('finds usages in .vue and .ts code, including i18n.global.t and <i18n-t keypath>', () => {
    expect(result.codeFiles).toBe(4)
    expect(audit.usedKeys).toBe(5)
    expect(audit.dead).toEqual(['common.unused'])
    expect(audit.maybeUsed).toEqual([{ key: 'order.status.pending', prefix: 'order.status.' }])
    // router.ts 的 meta.title 里存着 'common.cancel'，mock/menu.mock.ts 里存着 'typo'
    expect(audit.referencedAsLiteral).toEqual(['common.cancel', 'typo'])
    expect(audit.undefined.map((u) => `${u.key}@${u.loc.file}:${u.loc.line}`)).toEqual([
      'typoo@src/views/Home.vue:10',
    ])
    expect(audit.dynamicWithoutPrefix).toBe(1)
  })

  it('exits 1 because keys are missing and an undefined key is used', () => {
    expect(localesExitCode(result)).toBe(1)
  })

  it('formats a text report', () => {
    const out = formatLocalesText(result)
    expect(out).toContain('源语言 zh-CN（9 个 key）')
    expect(out).toMatch(/en-US\s+缺失\s+3\s+多余\s+1\s+空值\s+1/)
    expect(out).toContain('━━ 死 key（1）━━')
    expect(out).toContain('common.unused')
    expect(out).toContain('━━ 可能被动态使用（1）━━')
    expect(out).toContain('━━ 可能通过字面量引用（2）━━')
    expect(out).toContain('common.cancel')
    expect(out).toContain('━━ 未定义 key（1）━━')
    expect(out).toMatch(/src\/views\/Home\.vue:10\s+typoo/)
    expect(out).toContain('1 处动态调用没有静态前缀')
  })

  it('formats a JSON report', () => {
    const parsed = JSON.parse(formatLocalesJson(result)) as {
      audit: { dead: string[]; sourceKeys: number }
      files: unknown[]
    }
    expect(parsed.audit.sourceKeys).toBe(9)
    expect(parsed.audit.dead).toEqual(['common.unused'])
    expect(parsed.files).toHaveLength(5)
  })
})

describe('runLocales — configuration', () => {
  it('lets the source locale and locale globs be configured', async () => {
    const config = resolveConfig({ locales: { source: 'en-US', files: ['src/locales/*.json'] } })
    const result = await runLocales([], { cwd: demo, config })
    expect(result.audit.sourceLocale).toBe('en-US')
    expect(result.files.map((f) => f.locale)).toEqual(['en-US', 'zh-CN'])
    expect(result.audit.sourceKeys).toBe(7)
  })

  it('reports an error when the source locale cannot be found', async () => {
    const config = resolveConfig({ locales: { source: 'fr' } })
    const result = await runLocales([], { cwd: demo, config })
    expect(result.errors.map((e) => e.message).join(' ')).toMatch(/fr/)
    expect(localesExitCode(result)).toBe(1)
  })
})
