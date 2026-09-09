// 库入口：供配置文件与程序化调用使用。可执行入口在 bin.ts。
// 分层原则：所有 IO（fs / glob / process）只允许出现在这个包里。

export type { I18nTriageConfig, LoadedConfig, OutputFormat, ResolvedConfig } from './config'
export {
  DEFAULT_IGNORE,
  DEFAULT_INCLUDE,
  defineConfig,
  loadConfigFile,
  parseOnly,
  resolveConfig,
} from './config'
export type { DiscoverOptions } from './discover'
export { discoverFiles, toPosixRelative } from './discover'
export type { ScanOptions } from './scan'
export { scan } from './scan'
