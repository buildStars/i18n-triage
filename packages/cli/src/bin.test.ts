import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { SarifLog } from '@i18n-triage/reporters'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const bin = path.join(here, 'bin.ts')
const demo = path.resolve(here, '../../../examples/demo')

interface Run {
  code: number
  stdout: string
  stderr: string
}

/** 真正拉起 bin.ts（node --import tsx），覆盖参数解析、格式分派、--out、退出码 */
function run(args: string[]): Run {
  const result = spawnSync(process.execPath, ['--import', 'tsx', bin, ...args], {
    cwd: demo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  })
  return { code: result.status ?? -1, stdout: result.stdout, stderr: result.stderr }
}

/** 每个用例都要拉起一个 node 进程并用 tsx 即时编译整个 CLI，CI 机器上远不止 vitest 默认的 5 秒 */
const SLOW = { timeout: 120_000 }

describe('bin.ts — 端到端', () => {
  let out: string
  beforeAll(async () => {
    out = await mkdtemp(path.join(tmpdir(), 'i18n-triage-bin-'))
  })
  afterAll(async () => {
    await rm(out, { recursive: true, force: true })
  })

  it('prints the text report with the noise-ratio line and exits 0', SLOW, () => {
    const r = run(['.', '--only', 'all'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('降噪比')
    expect(r.stdout).toContain('━━ D 内部键（11）━━')
  })

  it('writes a SARIF 2.1.0 file with --format sarif --out', SLOW, async () => {
    const file = path.join(out, 'report.sarif')
    const r = run(['.', '--format', 'sarif', '--out', file])
    expect(r.code).toBe(0)
    expect(r.stderr).toContain('报告已写入')
    const sarif = JSON.parse(await readFile(file, 'utf8')) as SarifLog
    expect(sarif.version).toBe('2.1.0')
    const run0 = sarif.runs[0]
    expect(run0?.tool.driver.name).toBe('i18n-triage')
    expect(run0?.results.length).toBe(21 + 13) // A + C，与 scan.test.ts 的期望一致
    expect(
      run0?.results.every((x) =>
        x.locations[0]?.physicalLocation.artifactLocation.uri.startsWith('src/'),
      ),
    ).toBe(true)
    expect(run0?.properties.summary.byCategory.A_UI_TEXT).toBe(21)
  })

  it('rejects an unknown format with exit code 2', SLOW, () => {
    const r = run(['.', '--format', 'bogus'])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('未知输出格式')
  })

  it('rejects an unknown --only letter with exit code 2', SLOW, () => {
    const r = run(['.', '--only', 'A,X'])
    expect(r.code).toBe(2)
    expect(r.stderr).toContain('X')
  })

  it('runs the locales subcommand and exits 1 on an incomplete locale set', SLOW, () => {
    const localesDemo = path.resolve(here, '../../../examples/locales-demo')
    const r = run(['locales', localesDemo])
    expect(r.code).toBe(1)
    expect(r.stdout).toContain('源语言 zh-CN（9 个 key）')
    expect(r.stdout).toContain('━━ 死 key（2）━━')
    expect(r.stdout).toContain('typoo')
  })

  it('reports the version', SLOW, () => {
    const r = run(['--version'])
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/^i18n-triage\/\S+/)
  })
})
