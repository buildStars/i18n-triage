import type { Category } from '@i18n-triage/core'

export type CategoryLetter = 'A' | 'B' | 'C' | 'D'

/** 报告里的固定展示顺序 */
export const CATEGORIES: readonly Category[] = [
  'A_UI_TEXT',
  'B_DEBUG_LOG',
  'C_DICT',
  'D_INTERNAL_KEY',
]

export const CATEGORY_LETTER: Record<Category, CategoryLetter> = {
  A_UI_TEXT: 'A',
  B_DEBUG_LOG: 'B',
  C_DICT: 'C',
  D_INTERNAL_KEY: 'D',
}

export const CATEGORY_BY_LETTER: Record<CategoryLetter, Category> = {
  A: 'A_UI_TEXT',
  B: 'B_DEBUG_LOG',
  C: 'C_DICT',
  D: 'D_INTERNAL_KEY',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  A_UI_TEXT: 'A 必翻译 UI 文案',
  B_DEBUG_LOG: 'B 调试日志',
  C_DICT: 'C 数据字典',
  D_INTERNAL_KEY: 'D 内部键',
}

/** 默认只把「需要人处理」的两类推到用户面前 */
export const DEFAULT_ONLY: readonly Category[] = ['A_UI_TEXT', 'C_DICT']
