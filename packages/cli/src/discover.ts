import { stat } from 'node:fs/promises'
import path from 'node:path'

import { glob } from 'tinyglobby'

import type { ResolvedConfig } from './config'

export interface DiscoverOptions {
  cwd: string
  config: ResolvedConfig
}

export interface DiscoveredFile {
  absPath: string
  /**
   * 报告与 FileContext.relativePath 用的 posix 路径。
   * 目标在 cwd 之下 → 相对 cwd；目标在 cwd 之外 → 相对被扫描的那个目录（显式文件则相对其所在目录），
   * 永远不会出现 `../`。
   */
  relativePath: string
}

/** 相对 base 的 posix 路径（统一用 `/`） */
export function toPosixRelative(base: string, file: string): string {
  return path
    .relative(base, file)
    .split(/[\\/]+/)
    .join('/')
}

function isInside(base: string, file: string): boolean {
  const rel = path.relative(base, file)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * 把命令行给的路径展开成待扫描文件列表（按绝对路径去重、按相对路径排序）。
 * - 目录：按 config.include glob，应用 config.ignore
 * - 文件：原样接受（显式指定的文件不受 include / ignore 限制）
 * - 不存在的路径直接报错
 */
export async function discoverFiles(
  paths: readonly string[],
  { cwd, config }: DiscoverOptions,
): Promise<DiscoveredFile[]> {
  const targets = paths.length > 0 ? paths : ['.']
  const found = new Map<string, DiscoveredFile>()

  // 基准按「目标」而不是按「文件」选：目标目录在 cwd 之下就相对 cwd，否则相对目标目录本身，
  // 同一个目标下的文件基准一致，不会出现一部分相对 cwd、一部分相对目标的混合结果
  const baseFor = (root: string): string =>
    path.normalize(root) === path.normalize(cwd) || isInside(cwd, root) ? cwd : root
  const add = (absPath: string, root: string): void => {
    const normalized = path.normalize(absPath)
    if (found.has(normalized)) return
    found.set(normalized, {
      absPath: normalized,
      relativePath: toPosixRelative(baseFor(root), normalized),
    })
  }

  for (const target of targets) {
    const abs = path.resolve(cwd, target)
    let info
    try {
      info = await stat(abs)
    } catch {
      throw new Error(`路径不存在：${target}`)
    }
    if (info.isFile()) {
      add(abs, path.dirname(abs))
      continue
    }
    const matches = await glob(config.include, {
      cwd: abs,
      ignore: config.ignore,
      absolute: true,
      onlyFiles: true,
      dot: false,
    })
    for (const file of matches) add(file, abs)
  }

  return [...found.values()].sort((a, b) =>
    a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0,
  )
}
