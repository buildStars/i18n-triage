import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadConfigFile, resolveConfig } from './config'
import { formatFixSummary, runFix } from './fix'
import { scan } from './scan'

const here = path.dirname(fileURLToPath(import.meta.url))
const demo = path.resolve(here, '../../../examples/demo')

describe('runFix on a copy of examples/demo', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'i18n-triage-fix-'))
    await cp(demo, dir, { recursive: true })
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function configFor(cwd: string) {
    const loaded = await loadConfigFile(cwd)
    return resolveConfig(loaded?.config)
  }

  it('dry-run reports what it would do without touching any file', async () => {
    const before = await readFile(path.join(dir, 'src/views/Order.vue'), 'utf8')
    const summary = await runFix(['.'], { cwd: dir, config: await configFor(dir), dryRun: true })
    expect(summary.dryRun).toBe(true)
    expect(summary.replaced).toBe(11)
    expect(summary.changedFiles).toEqual(['src/views/Order.vue'])
    expect(await readFile(path.join(dir, 'src/views/Order.vue'), 'utf8')).toBe(before)
    await expect(stat(path.join(dir, 'src/locales/zh-CN.json'))).rejects.toThrow()
  })

  it('rewrites the sources, writes the locale file and reports skips by reason', async () => {
    const summary = await runFix(['.'], { cwd: dir, config: await configFor(dir) })

    expect(summary.replaced).toBe(11)
    expect(summary.changedFiles).toEqual(['src/views/Order.vue'])
    expect(summary.keysAdded).toBe(11)
    expect(summary.localeFile).toBe('src/locales/zh-CN.json')
    expect(summary.skippedByReason).toEqual({ unsure: 3, jsx: 4, 'no-t-in-scope': 3 })

    const vue = await readFile(path.join(dir, 'src/views/Order.vue'), 'utf8')
    expect(vue).toContain(`:placeholder="$t('请输入订单号')"`)
    expect(vue).toContain(`:title="$t('订单列表')"`)
    expect(vue).toContain(`<van-button type="primary" @click="load">{{ $t('刷新') }}</van-button>`)
    expect(vue).toContain(`@click="showToast($t('已复制'))">{{ $t('复制') }}`)
    expect(vue).toContain(`{{ item }} {{ $t('号订单') }}`)
    expect(vue).toContain(`showToast(t('加载成功'))`)
    expect(vue).toContain(`{ title: t('提示'), message: t('加载失败，是否重试？') }`)
    // 已有 const { t } = useI18n()，不能重复插入
    expect(vue.match(/useI18n\(/g)).toHaveLength(1)
    // 待确认与 B / D 原样保留
    expect(vue).toContain(`status.value === '已完成'`)
    expect(vue).toContain(`console.error('加载订单失败', err)`)
    expect(vue).toContain(`data-track="订单备注埋点"`)

    const locale = JSON.parse(
      await readFile(path.join(dir, 'src/locales/zh-CN.json'), 'utf8'),
    ) as Record<string, string>
    expect(Object.keys(locale)).toHaveLength(11)
    expect(locale['请输入订单号']).toBe('请输入订单号')
    expect(locale['加载失败，是否重试？']).toBe('加载失败，是否重试？')
  })

  it('is idempotent: a second run changes nothing and only unsure / unsupported items remain', async () => {
    const config = await configFor(dir)
    await runFix(['.'], { cwd: dir, config })
    const again = await runFix(['.'], { cwd: dir, config })
    expect(again.replaced).toBe(0)
    expect(again.changedFiles).toEqual([])
    expect(again.keysAdded).toBe(0)

    const report = await scan(['.'], { cwd: dir, config })
    const ruleMatchedA = report.results.filter(
      (r) => r.category === 'A_UI_TEXT' && r.matchedBy !== 'fallback',
    )
    // 剩下的 A 只能是被跳过的：JSX（Tip.tsx）与 .ts 里的（toast.ts / constants）
    expect(ruleMatchedA.map((r) => r.node.loc.file).sort()).toEqual([
      'src/components/Tip.tsx',
      'src/components/Tip.tsx',
      'src/components/Tip.tsx',
      'src/components/Tip.tsx',
      'src/components/Tip.tsx',
      'src/constants/order.ts',
      'src/utils/toast.ts',
    ])
  })

  it('merges into an existing locale file and reuses its keys', async () => {
    const config = await configFor(dir)
    const localePath = path.join(dir, 'src/locales/zh-CN.json')
    const { mkdir, writeFile } = await import('node:fs/promises')
    await mkdir(path.dirname(localePath), { recursive: true })
    await writeFile(
      localePath,
      JSON.stringify({ common: { refresh: '刷新' }, keep: '保留' }, null, 2),
    )

    const summary = await runFix(['.'], { cwd: dir, config })
    expect(summary.keysAdded).toBe(10)
    const vue = await readFile(path.join(dir, 'src/views/Order.vue'), 'utf8')
    expect(vue).toContain(`{{ $t('common.refresh') }}`)
    const locale = JSON.parse(await readFile(localePath, 'utf8')) as Record<string, unknown>
    expect(locale.keep).toBe('保留')
    expect(locale.common).toEqual({ refresh: '刷新' })
    expect(locale['请输入订单号']).toBe('请输入订单号')
  })

  it('formats a readable summary', async () => {
    const summary = await runFix(['.'], { cwd: dir, config: await configFor(dir), dryRun: true })
    const out = formatFixSummary(summary)
    expect(out).toContain('i18n-triage --fix  扫描 6 个文件，改写 1 个 （dry-run，未写入任何文件）')
    expect(out).toMatch(/替换文案\s+11 处/)
    expect(out).toMatch(/新增 key\s+11 个\s+→ src\/locales\/zh-CN\.json/)
    expect(out).toMatch(/跳过\s+10 处/)
    expect(out).toMatch(/unsure\s+3/)
    expect(out).toMatch(/jsx\s+4/)
    expect(out).toContain('━━ 将改写的文件（1）━━')
    expect(out).toMatch(/src\/views\/Order\.vue\s+11 处/)
    expect(out).toContain('━━ 跳过明细（10）━━')
    expect(out).toMatch(/19:26\s+"已完成"\s+unsure/)
  })

  it('honours fix options from the config: includeUnsure and a custom locale file', async () => {
    const config = resolveConfig({
      uiApis: ['myToast'],
      fix: { includeUnsure: true, localeFile: 'i18n/zh.json', fixPlainScripts: true },
    })
    const summary = await runFix(['.'], { cwd: dir, config })
    expect(summary.localeFile).toBe('i18n/zh.json')
    expect(summary.skippedByReason).toEqual({ jsx: 4 })
    const vue = await readFile(path.join(dir, 'src/views/Order.vue'), 'utf8')
    expect(vue).toContain(`{{ active ? $t('已选中') : $t('未选中') }}`)
    const toast = await readFile(path.join(dir, 'src/utils/toast.ts'), 'utf8')
    expect(toast).toContain(`myToast(t('操作成功'))`)
    await stat(path.join(dir, 'i18n/zh.json'))
  })
})
