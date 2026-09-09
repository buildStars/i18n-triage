#!/usr/bin/env node
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { formatJson, formatText } from '@i18n-triage/reporters'
import { cac } from 'cac'

import type { I18nTriageConfig, OutputFormat } from './config'
import { loadConfigFile, parseOnly, resolveConfig } from './config'
import { scan } from './scan'

const VERSION = '0.0.0'

interface CliOptions {
  format?: string
  only?: string
  config?: string
  out?: string
  color?: boolean
}

function parseFormat(input: string): OutputFormat {
  if (input === 'text' || input === 'json') return input
  throw new Error(`未知输出格式 "${input}"，--format 只接受 text | json`)
}

/** 命令行给的目标里哪些是目录：cwd 没有配置文件时，到这些目录里再找一次 */
async function directoryTargets(cwd: string, paths: readonly string[]): Promise<string[]> {
  const dirs: string[] = []
  for (const p of paths) {
    try {
      if ((await stat(path.resolve(cwd, p))).isDirectory()) dirs.push(p)
    } catch {
      // 不存在的路径交给 discoverFiles 报错
    }
  }
  return dirs
}

async function run(paths: string[], options: CliOptions): Promise<number> {
  const cwd = process.cwd()
  const loaded = await loadConfigFile(cwd, options.config, await directoryTargets(cwd, paths))

  const overrides: I18nTriageConfig = {}
  if (options.format !== undefined) overrides.format = parseFormat(options.format)
  if (options.only !== undefined) overrides.only = parseOnly(options.only)
  const config = resolveConfig({ ...loaded?.config, ...overrides })

  const report = await scan(paths, { cwd, config })

  const useColor =
    options.out === undefined &&
    options.color !== false &&
    process.stdout.isTTY === true &&
    process.env.NO_COLOR === undefined
  const output =
    config.format === 'json'
      ? formatJson(report, { only: config.only })
      : formatText(report, {
          only: config.only,
          color: useColor,
          dictSiblingThreshold: config.dictSiblingThreshold,
        })

  if (options.out !== undefined) {
    const outPath = path.resolve(cwd, options.out)
    await mkdir(path.dirname(outPath), { recursive: true })
    await writeFile(outPath, output, 'utf8')
    process.stderr.write(
      `i18n-triage: 报告已写入 ${outPath}（${report.summary.files} 个文件，A 类 ${report.summary.byCategory.A_UI_TEXT} 处）\n`,
    )
  } else {
    process.stdout.write(output)
  }

  return report.errors.length > 0 ? 1 : 0
}

const cli = cac('i18n-triage')

cli
  .command('[...paths]', '扫描目录 / 文件里的硬编码中文，按 A/B/C/D 分类，只把必翻译文案推到你面前')
  .option('--format <format>', '输出格式：text | json（默认 text）')
  .option('--only <letters>', '只显示指定类别，如 A,C（默认 A,C；all 为全部）')
  .option('--config <path>', '配置文件路径（默认自动查找 i18n-triage.config.{ts,js,mjs,json}）')
  .option('--out <path>', '把报告写入文件而不是打印到终端')
  .option('--no-color', '关闭终端颜色')
  .example('i18n-triage src')
  .example('i18n-triage src --only A --format json --out report.json')
  .action(async (paths: string[], options: CliOptions) => {
    try {
      process.exitCode = await run(paths, options)
    } catch (err) {
      process.stderr.write(`i18n-triage: ${err instanceof Error ? err.message : String(err)}\n`)
      process.exitCode = 2
    }
  })

cli.help()
cli.version(VERSION)
cli.parse()
