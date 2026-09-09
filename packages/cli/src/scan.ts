import { readFile as fsReadFile } from 'node:fs/promises'

import type { FileContext } from '@i18n-triage/core'
import {
  countChineseRuns,
  createDefaultRules,
  excludeI18nCalls,
  parseSource,
  triage,
} from '@i18n-triage/core'
import type { FileScan, ReportError, ScanReport, SkippedFile } from '@i18n-triage/reporters'
import { buildScanReport } from '@i18n-triage/reporters'

import type { ResolvedConfig } from './config'
import { discoverFiles } from './discover'

export interface ScanOptions {
  cwd: string
  config: ResolvedConfig
  /** 测试注入：返回 undefined 则走默认的 fs 读取 */
  readFile?: (absPath: string) => Promise<string | undefined>
}

/** 单行超过这个长度基本可以断定是压缩产物（手写源码里最长的 SVG path 行也在 1000 以内） */
const MINIFIED_LINE_LENGTH = 5_000

/**
 * 是否像压缩 / 打包产物：任何一行超长 → minified；整体超过 maxFileSize 字节 → too-large。
 * Day 7 在 yudao 里遇到 vendored 的 Tinyflow：index.umd.js 单行 19 万字符、index.js 506 KB，
 * 里面的中文全是第三方库内部文案，不该进报告。
 */
export function isProbablyGenerated(
  source: string,
  maxFileSize: number,
): SkippedFile['reason'] | null {
  if (source.length > maxFileSize) return 'too-large'
  let lineStart = 0
  for (;;) {
    const nl = source.indexOf('\n', lineStart)
    const end = nl === -1 ? source.length : nl
    if (end - lineStart > MINIFIED_LINE_LENGTH) return 'minified'
    if (nl === -1) return null
    lineStart = nl + 1
  }
}

/**
 * 扫描入口：发现文件 → 读取 → parseSource → excludeI18nCalls → triage → 汇总。
 * 单个文件读取或解析失败只记入 report.errors，压缩 / 超大文件记入 report.skipped，都不中断整体扫描。
 * 这是仓库里唯一同时接触文件系统与 core 的地方。
 */
export async function scan(paths: readonly string[], options: ScanOptions): Promise<ScanReport> {
  const { cwd, config } = options
  const files = await discoverFiles(paths, { cwd, config })
  const rules = createDefaultRules(config.rulesConfig)
  const scans: FileScan[] = []
  const errors: ReportError[] = []
  const skipped: SkippedFile[] = []

  for (const { absPath, relativePath } of files) {
    try {
      const source = (await options.readFile?.(absPath)) ?? (await fsReadFile(absPath, 'utf8'))
      const reason = isProbablyGenerated(source, config.maxFileSize)
      if (reason !== null) {
        skipped.push({ file: relativePath, reason })
        continue
      }
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

  return buildScanReport(scans, errors, skipped)
}
