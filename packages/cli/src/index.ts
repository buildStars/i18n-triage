// 库入口：供配置文件与程序化调用使用。可执行入口在 bin.ts。
// 分层原则：所有 IO（fs / glob / process）只允许出现在这个包里。

export type {
  FixConfig,
  I18nTriageConfig,
  LoadedConfig,
  LocalesConfig,
  OutputFormat,
  ResolvedConfig,
  ResolvedFixConfig,
  ResolvedLocalesConfig,
} from './config'
export {
  DEFAULT_FIX_CONFIG,
  DEFAULT_LOCALES_CONFIG,
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
export type { FixFileDetail, FixRunOptions, FixSummary } from './fix'
export { formatFixSummary, runFix } from './fix'
export type { LocaleFileInfo, LocalesResult, LocalesRunOptions } from './locales'
export {
  detectLocaleFile,
  formatLocalesJson,
  formatLocalesText,
  localesExitCode,
  runLocales,
} from './locales'
