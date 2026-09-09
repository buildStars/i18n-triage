import { stat } from 'node:fs/promises'
import path from 'node:path'

import { glob } from 'tinyglobby'

import type { ResolvedConfig } from './config'

export interface DiscoverOptions {
  cwd: string
  config: ResolvedConfig
}

/** 相对 base 的 posix 路径（报告与 FileContext.relativePath 统一用 `/`） */
export function toPosixRelative(base: string, file: string): string {
  return path
    .relative(base, file)
    .split(/[\\/]+/)
    .join('/')
}

/**
 * 把命令行给的路径展开成待扫描文件的绝对路径列表（去重、按 posix 相对路径排序）。
 * - 目录：按 config.include glob，应用 config.ignore
 * - 文件：原样接受（显式指定的文件不受 include / ignore 限制）
 * - 不存在的路径直接报错
 */
export async function discoverFiles(
  paths: readonly string[],
  { cwd, config }: DiscoverOptions,
): Promise<string[]> {
  const targets = paths.length > 0 ? paths : ['.']
  const found = new Set<string>()

  for (const target of targets) {
    const abs = path.resolve(cwd, target)
    let info
    try {
      info = await stat(abs)
    } catch {
      throw new Error(`路径不存在：${target}`)
    }
    if (info.isFile()) {
      found.add(path.normalize(abs))
      continue
    }
    const matches = await glob(config.include, {
      cwd: abs,
      ignore: config.ignore,
      absolute: true,
      onlyFiles: true,
      dot: false,
    })
    for (const file of matches) found.add(path.normalize(file))
  }

  return [...found].sort((a, b) => {
    const ra = toPosixRelative(cwd, a)
    const rb = toPosixRelative(cwd, b)
    return ra < rb ? -1 : ra > rb ? 1 : 0
  })
}
