import { matchesCallee } from './callee-match'
import { DEFAULT_DEBUG_APIS } from './defaults'
import type { NamedRule } from './named-rule'
import { defineRule } from './named-rule'

export interface DebugLogOptions {
  /** 调试 / 日志 API 模式列表，语法见 callee-match.ts */
  debugApis: readonly string[]
}

/**
 * B 调试日志：实参属于 console.* / logger.* / devLogger.* / debug.* / log 等调用。
 * 不限 kind——`console.log({ msg: 'x' })` 里的 object-value 同样带 calleeName，同样是 B。
 */
export function createDebugLogRule(options: Partial<DebugLogOptions> = {}): NamedRule {
  const apis = options.debugApis ?? DEFAULT_DEBUG_APIS
  return defineRule('b-debug-log', (node) =>
    node.calleeName !== undefined && matchesCallee(node.calleeName, apis) ? 'B_DEBUG_LOG' : null,
  )
}

export const bDebugLogRule: NamedRule = createDebugLogRule()
