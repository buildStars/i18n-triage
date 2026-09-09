#!/usr/bin/env node
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { formatJson, formatSarif, formatText } from '@i18n-triage/reporters'
import { cac } from 'cac'

import type { I18nTriageConfig, OutputFormat } from './config'
import { loadConfigFile, parseOnly, resolveConfig } from './config'
import { formatFixSummary, runFix } from './fix'
import { formatLocalesJson, formatLocalesText, localesExitCode, runLocales } from './locales'
import { scan } from './scan'

/** 构建时由 tsdown 的 define 注入 package.json 的 version；tsx 直接跑源码时没有这个常量 */
const VERSION = typeof __VERSION__ === 'string' ? __VERSION__ : '0.0.0-dev'
const INFORMATION_URI = 'https://github.com/buildStars/i18n-triage'

interface CliOptions {
  format?: string
  only?: string
  config?: string
  out?: string
  color?: boolean
  fix?: boolean
  dryRun?: boolean
  localeFile?: string
  includeUnsure?: boolean
}

function parseFormat(input: string): OutputFormat {
  if (input === 'text' || input === 'json' || input === 'sarif') return input
  throw new Error(`未知输出格式 "${input}"，--format 只接受 text | json | sarif`)
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
  const fixOverrides = {
    ...(options.localeFile !== undefined ? { localeFile: options.localeFile } : {}),
    ...(options.includeUnsure ? { includeUnsure: true } : {}),
  }
  const config = resolveConfig({
    ...loaded?.config,
    ...overrides,
    fix: { ...loaded?.config?.fix, ...fixOverrides },
  })

  const useColor =
    options.out === undefined &&
    options.color !== false &&
    process.stdout.isTTY === true &&
    process.env.NO_COLOR === undefined

  if (options.fix) {
    const summary = await runFix(paths, { cwd, config, dryRun: options.dryRun ?? false })
    process.stdout.write(formatFixSummary(summary, useColor))
    return summary.errors.length > 0 ? 1 : 0
  }

  const report = await scan(paths, { cwd, config })
  const output =
    config.format === 'json'
      ? formatJson(report, { only: config.only })
      : config.format === 'sarif'
        ? formatSarif(report, {
            only: config.only,
            toolVersion: VERSION,
            informationUri: INFORMATION_URI,
          })
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

interface LocalesCliOptions {
  format?: string
  source?: string
  localeFiles?: string
  config?: string
  out?: string
  color?: boolean
}

async function runLocalesCommand(paths: string[], options: LocalesCliOptions): Promise<number> {
  const cwd = process.cwd()
  const loaded = await loadConfigFile(cwd, options.config, await directoryTargets(cwd, paths))
  const localesOverrides = {
    ...(options.source !== undefined ? { source: options.source } : {}),
    ...(options.localeFiles !== undefined
      ? {
          files: options.localeFiles
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : {}),
  }
  const config = resolveConfig({
    ...loaded?.config,
    locales: { ...loaded?.config?.locales, ...localesOverrides },
  })
  const format = options.format ?? 'text'
  if (format !== 'text' && format !== 'json') {
    throw new Error(`未知输出格式 "${format}"，locales 只接受 text | json`)
  }

  const result = await runLocales(paths, { cwd, config })
  const useColor =
    options.out === undefined &&
    options.color !== false &&
    process.stdout.isTTY === true &&
    process.env.NO_COLOR === undefined
  const output = format === 'json' ? formatLocalesJson(result) : formatLocalesText(result, useColor)

  if (options.out !== undefined) {
    const outPath = path.resolve(cwd, options.out)
    await mkdir(path.dirname(outPath), { recursive: true })
    await writeFile(outPath, output, 'utf8')
    process.stderr.write(`i18n-triage locales: 报告已写入 ${outPath}\n`)
  } else {
    process.stdout.write(output)
  }
  return localesExitCode(result)
}

const cli = cac('i18n-triage')

cli
  .command('locales [...paths]', '校验语言包完整度，找出死 key 与代码里未定义的 key')
  .option('--format <format>', '输出格式：text | json（默认 text）')
  .option('--source <locale>', '源语言（默认 zh-CN）')
  .option(
    '--locale-files <globs>',
    '语言包 glob，逗号分隔（默认 **/locales/**、**/lang(s)/**、**/i18n/**）',
  )
  .option('--config <path>', '配置文件路径')
  .option('--out <path>', '把报告写入文件')
  .option('--no-color', '关闭终端颜色')
  .example('i18n-triage locales src')
  .example('i18n-triage locales src --source en --format json')
  .action(async (paths: string[], options: LocalesCliOptions) => {
    try {
      process.exitCode = await runLocalesCommand(paths, options)
    } catch (err) {
      process.stderr.write(`i18n-triage: ${err instanceof Error ? err.message : String(err)}\n`)
      process.exitCode = 2
    }
  })

cli
  .command('[...paths]', '扫描目录 / 文件里的硬编码中文，按 A/B/C/D 分类，只把必翻译文案推到你面前')
  .option(
    '--format <format>',
    '输出格式：text | json | sarif（默认 text；sarif 可直接上传 GitHub Code Scanning）',
  )
  .option('--only <letters>', '只显示指定类别，如 A,C（默认 A,C；all 为全部）')
  .option('--config <path>', '配置文件路径（默认自动查找 i18n-triage.config.{ts,js,mjs,json}）')
  .option('--out <path>', '把报告写入文件而不是打印到终端')
  .option('--no-color', '关闭终端颜色')
  .option('--fix', '把 A 类文案抽成 i18n key：改写源码为 $t() / t()，并写入语言包')
  .option('--dry-run', '配合 --fix：只报告将要做的改动，不写任何文件')
  .option(
    '--locale-file <path>',
    '配合 --fix：语言包路径，相对被扫描目录（默认 src/locales/zh-CN.json）',
  )
  .option('--include-unsure', '配合 --fix：连「待确认」的 A 类也一起改写')
  .example('i18n-triage src')
  .example('i18n-triage src --only A --format json --out report.json')
  .example('i18n-triage src --fix --dry-run')
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
