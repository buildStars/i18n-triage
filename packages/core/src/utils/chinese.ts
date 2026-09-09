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
