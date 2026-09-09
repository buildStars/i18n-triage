// 日志工具：所有中文都在调试 API 的实参里 → B

export const logger = {
  info: (...args: unknown[]) => console.log('[信息]', ...args),
  warn: (...args: unknown[]) => console.warn('[警告]', ...args),
  error: (...args: unknown[]) => console.error('[错误]', ...args),
}

export function traceRequest(url: string): void {
  console.debug(`请求开始：${url}`)
  logger.info('请求已发出')
}

const RE_CHINESE_NAME = /^[一-龥]{2,4}$/ // 正则字面量：忽略
