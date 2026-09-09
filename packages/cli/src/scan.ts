import { readFile as fsReadFile } from 'node:fs/promises'

import type { FileContext } from '@i18n-triage/core'
import {
  countChineseRuns,
  createDefaultRules,
  excludeI18nCalls,
  parseSource,
  triage,
} from '@i18n-triage/core'
import type { FileScan, ReportError, ScanReport } from '@i18n-triage/reporters'
import { buildScanReport } from '@i18n-triage/reporters'

import type { ResolvedConfig } from './config'
import { discoverFiles, toPosixRelative } from './discover'

export interface ScanOptions {
  cwd: string
  config: ResolvedConfig
  /** 测试注入：返回 undefined 则走默认的 fs 读取 */
  readFile?: (absPath: string) => Promise<string | undefined>
}

/**
 * 扫描入口：发现文件 → 读取 → parseSource → excludeI18nCalls → triage → 汇总。
 * 单个文件读取或解析失败只记入 report.errors，不中断整体扫描。
 * 这是仓库里唯一同时接触文件系统与 core 的地方。
 */
export async function scan(paths: readonly string[], options: ScanOptions): Promise<ScanReport> {
  const { cwd, config } = options
  const files = await discoverFiles(paths, { cwd, config })
  const rules = createDefaultRules(config.rulesConfig)
  const scans: FileScan[] = []
  const errors: ReportError[] = []

  for (const abs of files) {
    const relativePath = toPosixRelative(cwd, abs)
    try {
      const source = (await options.readFile?.(abs)) ?? (await fsReadFile(abs, 'utf8'))
      const ctx: FileContext = { relativePath }
      const nodes = parseSource(source, ctx)
      const kept = excludeI18nCalls(nodes, config.i18nCallees)
      scans.push({
        file: relativePath,
        results: triage(kept, ctx, rules),
        naiveCount: countChineseRuns(source),
        i18nExcluded: nodes.length - kept.length,
      })
    } catch (err) {
      errors.push({ file: relativePath, message: err instanceof Error ? err.message : String(err) })
    }
  }

  return buildScanReport(scans, errors)
}
