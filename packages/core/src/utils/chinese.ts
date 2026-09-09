/**
 * 中文检测正则 —— 全仓库唯一定义处，禁止在其他文件重复书写。
 *
 * 覆盖范围：
 * - U+4E00–U+9FFF  CJK Unified Ideographs（一 … 鿿）
 * - U+3400–U+4DBF  CJK Unified Ideographs Extension A（㐀 … 䶿）
 *
 * 不含全角标点（U+FF00 区），因此「，。！？」这类纯标点字符串不算中文。
 * 不带 `g` 标志，`test()` 无状态，可以安全地重复调用。
 */
export const CHINESE_RE = /[一-鿿㐀-䶿]/

/** 字符串中是否含有至少一个中文字符 */
export function containsChinese(text: string): boolean {
  return CHINESE_RE.test(text)
}

/** 连续中文字符组成的一段（由 CHINESE_RE 派生，不重复书写字符区间） */
const CHINESE_RUN_RE = new RegExp(`${CHINESE_RE.source}+`, 'g')

/**
 * 统计文本里「连续中文片段」的个数——这正是一个正则式扫描器会报出来的数量，
 * 用作报告里「扫到 N 处 → 需处理 M 处」降噪比的分母口径。
 */
export function countChineseRuns(text: string): number {
  return text.match(CHINESE_RUN_RE)?.length ?? 0
}
